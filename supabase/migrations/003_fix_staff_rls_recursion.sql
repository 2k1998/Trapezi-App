-- Fix: infinite recursion detected in policy for relation "staff"
-- The policy "Owner can read team" used a subquery on `staff` while evaluating
-- RLS on `staff`, which re-entered policy evaluation indefinitely.
-- Use SECURITY DEFINER so the membership check runs without RLS.

CREATE OR REPLACE FUNCTION public.current_user_is_owner_of_restaurant(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff
    WHERE id = auth.uid()
      AND role = 'owner'
      AND restaurant_id = p_restaurant_id
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_is_owner_of_restaurant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_owner_of_restaurant(uuid) TO authenticated;

DROP POLICY IF EXISTS "Owner can read team" ON public.staff;

CREATE POLICY "Owner can read team"
  ON public.staff FOR SELECT TO authenticated
  USING (public.current_user_is_owner_of_restaurant(restaurant_id));
