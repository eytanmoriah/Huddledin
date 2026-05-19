-- ═══════════════════════════════════════════════════════════════════
-- specialist_requests.matched_specialist_patient_id
-- Date: 2026-05-19
-- Design: audit-2026-05-10/fix-18-matching-ui-investigation.md
-- Sub-commit: 7a of N for the pre-parent-patients arc
-- ═══════════════════════════════════════════════════════════════════
--
-- Adds matched_specialist_patient_id to specialist_requests so
-- specialists can tag outgoing connection requests with a pre-parent
-- patient they've been working on. When the parent approves the
-- request, the specialist's frontend auto-fires the merge function
-- to consolidate clinical history.
--
-- Nullable: most requests don't have a match.
-- ON DELETE SET NULL: if the spec_patient is deleted, the request
-- remains intact and just loses the match.
-- No RLS change: existing specialist_requests policies cover this
-- column.
-- Partial index: only on rows where the column is non-null (small
-- subset of requests).
--
-- Apply manually via Supabase SQL Editor per Golden Rule #11.

ALTER TABLE specialist_requests
  ADD COLUMN matched_specialist_patient_id UUID NULL
  REFERENCES specialist_patients(id) ON DELETE SET NULL;

CREATE INDEX idx_specreq_matched_sp
  ON specialist_requests(matched_specialist_patient_id)
  WHERE matched_specialist_patient_id IS NOT NULL;

-- VERIFY:
-- (1) Column exists:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name='specialist_requests'
--     AND column_name='matched_specialist_patient_id';
--   Expected: 1 row, uuid, YES.
--
-- (2) FK constraint:
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid='specialist_requests'::regclass
--     AND conname LIKE '%matched%';
--   Expected: 1 row showing FK to specialist_patients(id) ON DELETE SET NULL.
--
-- (3) Partial index:
--   SELECT indexname, indexdef FROM pg_indexes
--   WHERE indexname='idx_specreq_matched_sp';
--   Expected: 1 row.

-- ROLLBACK:
-- DROP INDEX IF EXISTS idx_specreq_matched_sp;
-- ALTER TABLE specialist_requests DROP COLUMN IF EXISTS matched_specialist_patient_id;
