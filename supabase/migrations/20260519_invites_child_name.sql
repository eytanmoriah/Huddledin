-- ═══════════════════════════════════════════════════════════════════
-- invites.child_name (denormalize for pre-link RLS)
-- Date: 2026-05-19
-- Design: audit-2026-05-10/fix-22-invite-finalize-hotfix-investigation.md
-- Sub-commit: 11.1 (hotfix on 11) for the pre-parent-patients arc
-- ═══════════════════════════════════════════════════════════════════
--
-- Background: when a specialist accepts a parent-initiated magic link,
-- they are NOT yet on the child's care team (no approved
-- specialist_requests row exists until the accept flow writes it). RLS
-- on the children table denies SELECT to this specialist, so any
-- attempt to read children.name during the finalize-modal pre-flight
-- (Sub-commit 11) returns 406. The modal subtitle needs the child's
-- name, but cannot get it from children directly.
--
-- Fix: denormalize the child's name onto invites at INSERT time. The
-- name is already in the email body that goes to the recipient, so
-- exposing it on the row reveals no additional information.
--
-- Three current `children.name` lookups in _processPendingInvite (the
-- modal gate, the merge-failure toast, and the welcome toast) will all
-- be replaced with reads of invites.child_name (one of which works
-- today only because the SELECT comes after the specialist_requests
-- INSERT — but it is wasteful, so we replace it too).
--
-- Apply manually via Supabase SQL Editor per Golden Rule #11.

-- ───────────────────────────────────────────────────────────────────
-- Step 1: add nullable column
-- ───────────────────────────────────────────────────────────────────
ALTER TABLE invites ADD COLUMN child_name TEXT;

-- ───────────────────────────────────────────────────────────────────
-- Step 2: backfill from canonical source (children.name)
-- ───────────────────────────────────────────────────────────────────
UPDATE invites
   SET child_name = (SELECT name FROM children WHERE id = invites.child_id)
 WHERE child_name IS NULL AND child_id IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────
-- Step 3 — PRE-FLIGHT (run BEFORE Step 4; paste results to confirm)
-- ───────────────────────────────────────────────────────────────────
-- (a) Count rows with no child_id (unredeemable invites — the accept
--     handler at index.html:22693 dereferences data.child_id unconditionally).
--   SELECT COUNT(*) AS null_child_id_rows FROM invites WHERE child_id IS NULL;
--
-- (b) Count rows still missing child_name after backfill (orphan
--     child_ids pointing to deleted children rows).
--   SELECT COUNT(*) AS unfilled_child_name FROM invites WHERE child_name IS NULL;
--
-- ───────────────────────────────────────────────────────────────────
-- Conditional cleanup (run ONLY if Step 3a returned > 0)
-- ───────────────────────────────────────────────────────────────────
-- Delete invites with NULL child_id (unredeemable):
--   DELETE FROM invites WHERE child_id IS NULL;
--
-- If Step 3b still returns > 0 AFTER the DELETE above, investigate
-- before proceeding to Step 4 (orphan child_ids — the FK is loose).

-- ───────────────────────────────────────────────────────────────────
-- Step 4: enforce NOT NULL (run ONLY after Step 3 confirms ZERO unfilled rows)
-- ───────────────────────────────────────────────────────────────────
ALTER TABLE invites ALTER COLUMN child_name SET NOT NULL;

-- ───────────────────────────────────────────────────────────────────
-- VERIFY queries — paste after Steps 1+2+4 complete
-- ───────────────────────────────────────────────────────────────────
--
-- (1) Column exists with NOT NULL:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name='invites' AND column_name='child_name';
--   Expected: 1 row, text, NO.
--
-- (2) Test fixture has child_name populated:
--   SELECT id, child_id, child_name, accepted FROM invites
--   WHERE id = '210150da-d735-486e-9f00-7b193c600ca1';
--   Expected: child_name = 'Tset Tset'.

-- ───────────────────────────────────────────────────────────────────
-- ROLLBACK (only if verification fails — drops the column entirely)
-- ───────────────────────────────────────────────────────────────────
-- ALTER TABLE invites DROP COLUMN IF EXISTS child_name;
