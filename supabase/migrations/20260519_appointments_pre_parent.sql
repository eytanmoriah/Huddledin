-- ═══════════════════════════════════════════════════════════════════
-- appointments pre-parent extension
-- Date: 2026-05-19
-- Design: audit-2026-05-10/fix-13-appointments-pre-parent-investigation.md
-- Sub-commit: 4c of N for the pre-parent-patients arc
-- ═══════════════════════════════════════════════════════════════════
--
-- Extends appointments to support pre-parent patient appointments. New
-- column specialist_patient_id references specialist_patients. The
-- existing child_id and household_id columns are ALREADY nullable
-- (verified May 19) so no ALTER COLUMN needed.
--
-- The CHECK constraint enforces "0 or 1 patient reference" — preserving
-- the existing specialist-personal-appointment use case (29 rows have
-- both NULL today, both Lauri's real meetings and Eytan's legacy test
-- data). Never allow BOTH child_id AND specialist_patient_id set.
--
-- Live RLS policies use `specialist_id = auth.uid()` as one of their OR
-- clauses, which already matches pre-parent rows. NO policy rewrites
-- needed — same Scenario A as vault_notes might-have-been.
--
-- Apply manually via Supabase SQL Editor per Golden Rule #11.
--
-- Pre-verify (run before applying):
--   1. SELECT data_type, is_nullable FROM information_schema.columns
--      WHERE table_name='appointments' AND column_name='child_id';
--      Expected: uuid, YES (already verified).
--   2. SELECT data_type, is_nullable FROM information_schema.columns
--      WHERE table_name='appointments' AND column_name='household_id';
--      Expected: uuid, YES (already verified).
--   3. SELECT COUNT(*) FROM appointments
--      WHERE child_id IS NOT NULL AND household_id IS NOT NULL
--      AND child_id IS NOT NULL;
--      Just a sanity sample, not blocking.

-- ───────────────────────────────────────────────────────────────────
-- PHASE A: Schema changes
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE appointments
  ADD COLUMN specialist_patient_id UUID NULL
  REFERENCES specialist_patients(id) ON DELETE CASCADE;

CREATE INDEX idx_appointments_spec_patient
  ON appointments(specialist_patient_id)
  WHERE specialist_patient_id IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────
-- PHASE B: CHECK constraint
--
-- "0 or 1 patient reference" allows:
--   - Connected child appointments (child_id set, specialist_patient_id null)
--   - Pre-parent appointments (specialist_patient_id set, child_id null)
--   - Specialist personal appointments (both null)
--
-- Disallows: BOTH child_id AND specialist_patient_id set.
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE appointments
  ADD CONSTRAINT appointments_patient_xor CHECK (
    NOT (child_id IS NOT NULL AND specialist_patient_id IS NOT NULL)
  );

-- ───────────────────────────────────────────────────────────────────
-- VERIFY queries — paste after applying
-- ───────────────────────────────────────────────────────────────────
--
-- (1) Confirm new column:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name='appointments' AND column_name='specialist_patient_id';
--   Expected: 1 row, uuid, YES.
--
-- (2) Confirm partial index:
--   SELECT indexname, indexdef FROM pg_indexes
--   WHERE indexname='idx_appointments_spec_patient';
--   Expected: 1 row, partial index on (specialist_patient_id) WHERE NOT NULL.
--
-- (3) Confirm CHECK constraint:
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid='appointments'::regclass AND conname='appointments_patient_xor';
--   Expected: 1 row showing the NOT (both NOT NULL) constraint.
--
-- (4) Confirm existing rows still valid:
--   SELECT COUNT(*) FROM appointments;
--   Expected: same count as before (constraint allows all existing rows).

-- ───────────────────────────────────────────────────────────────────
-- ROLLBACK (only if verification fails)
-- ───────────────────────────────────────────────────────────────────
--
-- ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_patient_xor;
-- DROP INDEX IF EXISTS idx_appointments_spec_patient;
-- ALTER TABLE appointments DROP COLUMN IF EXISTS specialist_patient_id;
