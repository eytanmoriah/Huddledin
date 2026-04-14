-- Migration: Add household_id to subscriptions table
-- Purpose: Enables household-wide cancellation without joining profiles table
-- Run this in the Supabase Dashboard SQL Editor:
--   https://supabase.com/dashboard/project/smgbojgrdezasxciloll/sql

-- Step 1: Add the column
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS household_id text;

-- Step 2: Backfill from profiles table
UPDATE public.subscriptions
SET household_id = (
  SELECT p.household_id::text
  FROM public.profiles p
  WHERE p.id = subscriptions.user_id
)
WHERE household_id IS NULL;

-- Step 3: Create index for fast household-wide queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_household_id
  ON public.subscriptions (household_id)
  WHERE household_id IS NOT NULL;

-- Verify
SELECT user_id, status, household_id, paddle_subscription_id
FROM public.subscriptions
ORDER BY created_at DESC
LIMIT 10;
