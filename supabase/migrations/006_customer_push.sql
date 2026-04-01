-- Migration 006: Customer push subscriptions
-- Adds order_id + subscriber_type to push_subscriptions so customers
-- can subscribe without a staff account.
-- Also adds confirmed_push_sent flag on orders.

-- 1. Make staff_id nullable — customers have no staff record
ALTER TABLE push_subscriptions
  ALTER COLUMN staff_id DROP NOT NULL;

-- 2. New columns on push_subscriptions
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS subscriber_type text
  DEFAULT 'staff'
  CHECK (subscriber_type IN ('staff', 'customer'));

-- 3. Backfill existing rows (all pre-existing rows are staff subscriptions)
UPDATE push_subscriptions
  SET subscriber_type = 'staff'
  WHERE subscriber_type IS NULL;

-- 4. Index for customer push lookups (order ready notification)
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_order_id
  ON push_subscriptions(order_id);

-- 5. RLS: allow anonymous customers to save their own subscriptions
--    Security is enforced server-side in the API route (order + restaurant validation).

CREATE POLICY "Customers can insert push subscriptions"
  ON public.push_subscriptions
  FOR INSERT
  WITH CHECK (subscriber_type = 'customer');

CREATE POLICY "Customers can delete their own push subscriptions"
  ON public.push_subscriptions
  FOR DELETE
  USING (subscriber_type = 'customer');

-- 6. confirmed_push_sent on orders
--    Set to true once the "Order confirmed!" push has been delivered to the customer.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS confirmed_push_sent boolean DEFAULT false;
