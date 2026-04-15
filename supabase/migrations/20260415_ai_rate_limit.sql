-- Track AI endpoint usage per user for hourly rate limiting.
-- Inserted by api/_rate-limit.mjs on every successful AI call.
CREATE TABLE IF NOT EXISTS ai_usage (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  called_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_usage_user_hour ON ai_usage(user_id, called_at DESC);

-- Only service-role (API routes) reads & writes. Enable RLS with no policies to block anon/authenticated access.
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
