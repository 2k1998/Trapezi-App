-- Migration 004: Phase 4 notifications
-- Adds push_subscriptions table and notification-tracking columns on orders

-- 1. New table: push_subscriptions
--    Stores Web Push endpoints per staff member
CREATE TABLE push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  endpoint      text NOT NULL,
  p256dh        text NOT NULL,
  auth          text NOT NULL,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (endpoint)
);

CREATE INDEX idx_push_subscriptions_restaurant_id
  ON push_subscriptions(restaurant_id);

CREATE INDEX idx_push_subscriptions_staff_id
  ON push_subscriptions(staff_id);

-- 2. Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Staff can only manage their own subscriptions
CREATE POLICY "Staff can insert own subscriptions"
  ON push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (staff_id = auth.uid());

CREATE POLICY "Staff can select own subscriptions"
  ON push_subscriptions FOR SELECT TO authenticated
  USING (staff_id = auth.uid());

CREATE POLICY "Staff can delete own subscriptions"
  ON push_subscriptions FOR DELETE TO authenticated
  USING (staff_id = auth.uid());

-- 3. New columns on orders for SMS delivery tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sms_payment_sent_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sms_ready_sent_at   timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_locale     text;
