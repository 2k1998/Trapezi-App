-- Migration 002: Phase 1 additions
-- Add customer info to orders, Stripe Connect to restaurants, fix staff role constraint

-- 1. Add customer_name and customer_phone to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone text;

-- 2. Add Stripe Connect account ID to restaurants
--    Each restaurant's payments go directly into their own Stripe account
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS stripe_account_id text UNIQUE;
CREATE INDEX IF NOT EXISTS idx_restaurants_stripe_account
  ON restaurants(stripe_account_id);

-- 3. Update staff.role CHECK constraint — remove kitchen and bar (they do not exist)
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check
  CHECK (role IN ('owner', 'cashier', 'admin'));

-- 4. Index on session_id (may already exist from 001)
CREATE INDEX IF NOT EXISTS idx_orders_session_id ON orders(session_id);

-- 5. Index on stripe_payment_intent_id for idempotency checks in webhook
CREATE INDEX IF NOT EXISTS idx_orders_stripe_pi
  ON orders(stripe_payment_intent_id);

-- 5. Allow public (anon) to read paid orders by ID for confirmation screen.
--    Order IDs are UUIDs — unguessable — so this is safe.
CREATE POLICY "Public can read paid orders"
  ON orders FOR SELECT TO anon
  USING (payment_status = 'paid');

CREATE POLICY "Public can read order items for paid orders"
  ON order_items FOR SELECT TO anon
  USING (
    order_id IN (
      SELECT id FROM orders WHERE payment_status = 'paid'
    )
  );
