-- 2026-05-12: Add is_admin column to profiles, replace email-equality
-- admin check.
--
-- The three admin endpoints (api/admin-stats.js, api/admin-action.js,
-- api/admin-user-detail.js) currently check `user.email ===
-- 'admin@huddledin.com'` to determine admin status. This migration
-- introduces a proper is_admin flag on profiles. The .js endpoints +
-- index.html gates are updated in Sub-commit 2 of this arc.
--
-- This file documents the schema change to be applied manually via the
-- Supabase SQL Editor per Golden Rule #11.

ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index supports the per-request admin check at near-zero cost
-- given the size will be 1-2 rows.
CREATE INDEX idx_profiles_is_admin ON profiles(id) WHERE is_admin = true;

-- Seed the existing admin account.
UPDATE profiles SET is_admin = true
WHERE id = 'e13a20dc-eb6b-4390-b1bd-a4bd764b9a01';

-- Verify exactly one row updated:
-- SELECT id, is_admin FROM profiles WHERE is_admin = true;
