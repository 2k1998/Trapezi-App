-- Migration 008: Phase 5b — Analytics & Reporting
-- Adds indexes for analytics queries, manager role, and updates RLS policies.

-- ─── INDEXES ────────────────────────────────────────────────────────────────
-- 001 already has idx_orders_restaurant_created; all use IF NOT EXISTS.
CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON orders(created_at);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created
  ON orders(restaurant_id, created_at);

CREATE INDEX IF NOT EXISTS idx_order_items_restaurant
  ON order_items(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_order_items_name_snapshot
  ON order_items(name_snapshot);

-- ─── MANAGER ROLE ────────────────────────────────────────────────────────────
-- Keep 'admin' in constraint — platform admin accounts use that role.
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check
  CHECK (role IN ('owner', 'cashier', 'admin', 'manager'));

-- ─── RLS: staff ─────────────────────────────────────────────────────────────
-- Migration 003 fixed infinite recursion in the staff policy by wrapping the
-- role check in a SECURITY DEFINER function. We extend that pattern here to
-- also allow the manager role.  The function runs outside RLS so the inner
-- SELECT FROM staff does not re-enter policy evaluation.

CREATE OR REPLACE FUNCTION public.current_user_is_owner_or_manager_of_restaurant(p_restaurant_id uuid)
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
      AND role IN ('owner', 'manager')
      AND restaurant_id = p_restaurant_id
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_is_owner_or_manager_of_restaurant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_owner_or_manager_of_restaurant(uuid) TO authenticated;

-- Replace the migration-003 policy with a version that covers manager too.
DROP POLICY IF EXISTS "Owner can read team" ON public.staff;
DROP POLICY IF EXISTS "Owner or manager can read team" ON public.staff;

CREATE POLICY "Owner or manager can read team"
  ON public.staff FOR SELECT TO authenticated
  USING (public.current_user_is_owner_or_manager_of_restaurant(restaurant_id));

-- ─── RLS: restaurants ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Owner can update own restaurant" ON restaurants;
CREATE POLICY "Owner or manager can update own restaurant"
  ON restaurants FOR UPDATE TO authenticated
  USING (id IN (
    SELECT restaurant_id FROM staff
    WHERE id = auth.uid() AND role IN ('owner', 'manager')
  ));

-- ─── RLS: tables ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Owner can manage tables" ON tables;
CREATE POLICY "Owner or manager can manage tables"
  ON tables FOR ALL TO authenticated
  USING (restaurant_id IN (
    SELECT restaurant_id FROM staff
    WHERE id = auth.uid() AND role IN ('owner', 'manager')
  ));

-- ─── RLS: menu_items ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Owner can manage menu items" ON menu_items;
CREATE POLICY "Owner or manager can manage menu items"
  ON menu_items FOR ALL TO authenticated
  USING (restaurant_id IN (
    SELECT restaurant_id FROM staff
    WHERE id = auth.uid() AND role IN ('owner', 'manager')
  ));

-- ─── RLS: categories ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Owner can manage categories" ON categories;
CREATE POLICY "Owner or manager can manage categories"
  ON categories FOR ALL TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM staff WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

-- ─── RLS: menus ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Owner can manage menus" ON menus;
CREATE POLICY "Owner or manager can manage menus"
  ON menus FOR ALL TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM staff WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

-- ─── RLS: menu_schedules ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Owner can manage schedules" ON menu_schedules;
CREATE POLICY "Owner or manager can manage schedules"
  ON menu_schedules FOR ALL TO authenticated
  USING (
    menu_id IN (
      SELECT id FROM menus WHERE restaurant_id IN (
        SELECT restaurant_id FROM staff WHERE id = auth.uid() AND role IN ('owner', 'manager')
      )
    )
  );

-- ─── RLS: menu_item_assignments ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Owner can manage assignments" ON menu_item_assignments;
CREATE POLICY "Owner or manager can manage assignments"
  ON menu_item_assignments FOR ALL TO authenticated
  USING (
    menu_id IN (
      SELECT id FROM menus WHERE restaurant_id IN (
        SELECT restaurant_id FROM staff WHERE id = auth.uid() AND role IN ('owner', 'manager')
      )
    )
  );

-- ─── RLS: upsell_suggestions ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Owner can manage upsells" ON upsell_suggestions;
CREATE POLICY "Owner or manager can manage upsells"
  ON upsell_suggestions FOR ALL TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM staff WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

-- ─── RLS: happy_hour_rules ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Owner can manage happy hour rules" ON happy_hour_rules;
CREATE POLICY "Owner or manager can manage happy hour rules"
  ON happy_hour_rules FOR ALL TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM staff WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

-- ─── RLS: happy_hour_item_assignments ────────────────────────────────────────
DROP POLICY IF EXISTS "Owner can manage happy hour assignments" ON happy_hour_item_assignments;
CREATE POLICY "Owner or manager can manage happy hour assignments"
  ON happy_hour_item_assignments FOR ALL TO authenticated
  USING (
    rule_id IN (
      SELECT id FROM happy_hour_rules WHERE restaurant_id IN (
        SELECT restaurant_id FROM staff WHERE id = auth.uid() AND role IN ('owner', 'manager')
      )
    )
  );
