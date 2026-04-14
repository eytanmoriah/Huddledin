-- Add cancel_url column to subscriptions table
-- Stores the Paddle management cancel URL from webhook events
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_url TEXT;
