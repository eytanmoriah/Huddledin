-- ═══════════════════════════════════════════════════════════════════
-- intake schema (specialist_intake_templates + intake_responses)
-- Date: 2026-05-19
-- Design: audit-2026-05-10/fix-16-intake-schema-investigation.md
-- Sub-commit: 5 of N for the pre-parent-patients arc
-- ═══════════════════════════════════════════════════════════════════
--
-- Creates two tables for the intake feature. NO UI wiring in this
-- sub-commit — schema only. UI is a separate future arc.
--
-- Design notes:
-- - intake_responses.specialist_patient_id is NOT NULL (no polymorphic
--   FK). Connected children that never had a pre-parent phase will get
--   an auto-created specialist_patients row when intake UI ships
--   (UI decision, schema agnostic).
-- - Sub-commit 6 (merge function) does NOT migrate intake responses.
--   They stay anchored to specialist_patient_id forever; post-link
--   queries join through specialist_patients.linked_child_id.
-- - fields/responses are JSONB with schema-on-read at form-render time.
--   No constraint enforcement at the DB level.
--
-- Apply manually via Supabase SQL Editor per Golden Rule #11.

-- ───────────────────────────────────────────────────────────────────
-- PHASE A: specialist_intake_templates
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE specialist_intake_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  description TEXT NULL,
  fields JSONB NOT NULL DEFAULT '[]',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  times_used INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_intake_templates_specialist
  ON specialist_intake_templates(specialist_id);

ALTER TABLE specialist_intake_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY intake_templates_owner_all
  ON specialist_intake_templates FOR ALL
  USING (specialist_id = auth.uid())
  WITH CHECK (specialist_id = auth.uid());

-- ───────────────────────────────────────────────────────────────────
-- PHASE B: intake_responses
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE intake_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES specialist_intake_templates(id) ON DELETE CASCADE,
  specialist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  specialist_patient_id UUID NOT NULL REFERENCES specialist_patients(id) ON DELETE CASCADE,
  name TEXT NULL,
  responses JSONB NOT NULL DEFAULT '{}',
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_intake_responses_template
  ON intake_responses(template_id);

CREATE INDEX idx_intake_responses_spec_patient
  ON intake_responses(specialist_patient_id);

CREATE INDEX idx_intake_responses_specialist
  ON intake_responses(specialist_id);

ALTER TABLE intake_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY intake_responses_owner_all
  ON intake_responses FOR ALL
  USING (specialist_id = auth.uid())
  WITH CHECK (specialist_id = auth.uid());

-- ───────────────────────────────────────────────────────────────────
-- PHASE C: Realtime publication
-- ───────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE intake_responses;

-- ───────────────────────────────────────────────────────────────────
-- VERIFY queries
-- ───────────────────────────────────────────────────────────────────
--
-- (1) Tables exist:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_name IN ('specialist_intake_templates','intake_responses')
--     AND table_schema='public';
--   Expected: 2 rows.
--
-- (2) Indexes:
--   SELECT indexname FROM pg_indexes
--   WHERE tablename IN ('specialist_intake_templates','intake_responses')
--   ORDER BY indexname;
--   Expected: at least 4 indexes (1 template + 3 responses) plus
--   2 implicit PK indexes = 6 rows.
--
-- (3) RLS policies:
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE tablename IN ('specialist_intake_templates','intake_responses');
--   Expected: 2 rows (one ALL policy per table).
--
-- (4) Realtime publication:
--   SELECT pubname FROM pg_publication_tables WHERE tablename='intake_responses';
--   Expected: 1 row (supabase_realtime).
--   SELECT pubname FROM pg_publication_tables WHERE tablename='specialist_intake_templates';
--   Expected: 0 rows (templates skip realtime per design).

-- ───────────────────────────────────────────────────────────────────
-- ROLLBACK (only if verification fails)
-- ───────────────────────────────────────────────────────────────────
--
-- ALTER PUBLICATION supabase_realtime DROP TABLE intake_responses;
-- DROP TABLE intake_responses;
-- DROP TABLE specialist_intake_templates;
