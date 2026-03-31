-- Migration 005: Cron job failure tracking
-- Records cron job failures for manual review and retry

CREATE TABLE cron_failures (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name      text NOT NULL,
  failed_at     timestamptz DEFAULT now(),
  error_message text,
  retried       boolean DEFAULT false
);

CREATE INDEX idx_cron_failures_job_name ON cron_failures(job_name);
CREATE INDEX idx_cron_failures_failed_at ON cron_failures(failed_at);
