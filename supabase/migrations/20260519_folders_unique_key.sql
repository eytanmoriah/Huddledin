-- ═══════════════════════════════════════════════════════════════════
-- folders unique-key per patient axis
-- Date: 2026-05-19
-- Sub-commit: 4h.1 of N
-- ═══════════════════════════════════════════════════════════════════
--
-- Adds partial unique indexes preventing duplicate folder rows with
-- the same key for the same patient axis. Exposed by Sub-commit 4h
-- verification: lazy auto-create on pre-parent Files tab produced
-- two "Patient Files" rows 360ms apart.
--
-- Two partial unique indexes (one per patient axis):
--   - (specialist_patient_id, key) WHERE specialist_patient_id IS NOT NULL
--   - (child_id, key) WHERE child_id IS NOT NULL
--
-- Doesn't fight the XOR constraint — each row matches exactly one
-- index. NULL values are excluded from the partial index entirely.
--
-- Apply manually via Supabase SQL Editor per Golden Rule #11.

CREATE UNIQUE INDEX IF NOT EXISTS folders_spec_patient_key_unique
  ON folders(specialist_patient_id, key)
  WHERE specialist_patient_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS folders_child_key_unique
  ON folders(child_id, key)
  WHERE child_id IS NOT NULL;

-- ROLLBACK:
-- DROP INDEX IF EXISTS folders_child_key_unique;
-- DROP INDEX IF EXISTS folders_spec_patient_key_unique;

-- VERIFY:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename='folders'
-- AND indexname LIKE '%_unique';
-- Expected: 2 rows.
