-- ═══════════════════════════════════════════════════════════════════
-- vault_notes pending_publish column
-- Date: 2026-05-18
-- Sub-commit: 4b.1 of N
-- ═══════════════════════════════════════════════════════════════════
--
-- Adds pending_publish BOOLEAN to track pre-parent notes that should
-- auto-publish when the patient is linked to a parent (via Sub-commit
-- 6's merge function).
--
-- For connected-child notes, pending_publish stays FALSE always.
-- For pre-parent notes, specialists can choose "publish when connected"
-- which sets pending_publish=TRUE and published=FALSE. On merge, the
-- function sets published=TRUE and pending_publish=FALSE.
--
-- No RLS policy changes — existing policies don't reference
-- pending_publish, and the parent-side SELECT filter (published=true)
-- still correctly excludes pending-publish notes.
--
-- Apply manually via Supabase SQL Editor per Golden Rule #11.

ALTER TABLE vault_notes
  ADD COLUMN pending_publish BOOLEAN NOT NULL DEFAULT FALSE;

-- Migrate the May 18 test note (Eytan's "test" note that got incorrectly
-- marked published=true on a pre-parent context — see Sub-commit 4b
-- verification logs). Reset state:
UPDATE vault_notes
SET published = false, pending_publish = true
WHERE id = 'v_1779135471571'
  AND specialist_patient_id IS NOT NULL
  AND child_id IS NULL;

-- VERIFY:
-- 1. Confirm column added:
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name='vault_notes' AND column_name='pending_publish';
--   Expected: 1 row, boolean, NO, 'false'.
--
-- 2. Confirm test note state corrected:
--   SELECT id, title, published, pending_publish, child_id, specialist_patient_id
--   FROM vault_notes WHERE id='v_1779135471571';
--   Expected: published=false, pending_publish=true.

-- ROLLBACK:
-- UPDATE vault_notes SET published=true, pending_publish=false
--   WHERE id='v_1779135471571';
-- ALTER TABLE vault_notes DROP COLUMN IF EXISTS pending_publish;
