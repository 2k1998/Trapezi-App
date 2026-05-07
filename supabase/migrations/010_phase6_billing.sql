ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS contract_start_date     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_customer_id      TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status     TEXT NOT NULL DEFAULT 'active'
                                                   CHECK (subscription_status IN ('active', 'past_due', 'cancelled')),
  ADD COLUMN IF NOT EXISTS current_period_end      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dunning_day             INTEGER NOT NULL DEFAULT 0;
