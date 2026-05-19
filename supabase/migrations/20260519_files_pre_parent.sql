-- ═══════════════════════════════════════════════════════════════════
-- folders + files pre-parent extension + storage Pattern G
-- Date: 2026-05-19
-- Design: audit-2026-05-10/fix-15-files-pre-parent-investigation.md
-- Sub-commit: 4g of N for the pre-parent-patients arc
-- ═══════════════════════════════════════════════════════════════════
--
-- Extends folders and files to support pre-parent patient files via
-- Path X. Adds Pattern G to the storage RLS helper function so
-- spec_patient/{id}/... paths are accessible by the owning specialist
-- (and by the linked household after merge).
--
-- folder_permissions is NOT extended — pre-parent uses direct ownership
-- via specialist_patients.specialist_id. The merge function (Sub-commit
-- 6) inserts folder_permissions grants at link time, not pre-link.
--
-- All table-level RLS policies on folders/files already handle
-- pre-parent correctly:
-- - folders.allow_* policies are wide-open (USING true) — pre-existing
--   HIPAA gap, separate concern.
-- - files.uploaded_by = auth.uid() ALL policy covers specialist
--   ownership.
-- - Parent-side and household-join policies naturally exclude
--   pre-parent rows (child_id IS NULL fails the join).
--
-- Apply manually via Supabase SQL Editor per Golden Rule #11.
--
-- Pre-verify (already confirmed May 19):
--   SELECT COUNT(*) FROM folders WHERE child_id IS NULL; -- 0
--   SELECT COUNT(*) FROM folder_permissions WHERE child_id IS NULL; -- 0
--   SELECT COUNT(*) FROM files WHERE child_id IS NULL; -- 0 today,
--     non-zero with inbox in the future (correct)

-- ───────────────────────────────────────────────────────────────────
-- PHASE A: folders schema
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE folders
  ADD COLUMN specialist_patient_id UUID NULL
  REFERENCES specialist_patients(id) ON DELETE CASCADE;

CREATE INDEX idx_folders_spec_patient
  ON folders(specialist_patient_id)
  WHERE specialist_patient_id IS NOT NULL;

ALTER TABLE folders
  ADD CONSTRAINT folders_patient_xor CHECK (
    (child_id IS NOT NULL AND specialist_patient_id IS NULL)
    OR (child_id IS NULL AND specialist_patient_id IS NOT NULL)
  );

-- ───────────────────────────────────────────────────────────────────
-- PHASE B: files schema (relaxed XOR allows BOTH NULL for inbox)
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE files
  ADD COLUMN specialist_patient_id UUID NULL
  REFERENCES specialist_patients(id) ON DELETE CASCADE;

CREATE INDEX idx_files_spec_patient
  ON files(specialist_patient_id)
  WHERE specialist_patient_id IS NOT NULL;

ALTER TABLE files
  ADD CONSTRAINT files_patient_xor CHECK (
    NOT (child_id IS NOT NULL AND specialist_patient_id IS NOT NULL)
  );

-- ───────────────────────────────────────────────────────────────────
-- PHASE C: Storage RLS — add Pattern G for spec_patient/{id}/...
--
-- CREATE OR REPLACE the function preserving all 6 existing patterns
-- byte-for-byte. Pattern G inserted before the final RETURN false.
--
-- Pattern G:
-- - Path shape: spec_patient/{spec_patient_id}/...
-- - Permits the owning specialist (specialist_patients.specialist_id
--   = auth.uid()) for all ops.
-- - Post-merge (when specialist_patients.linked_child_id is set),
--   also permits members of the linked child's household — same files
--   become visible to the parent without moving storage paths.
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.can_access_huddledin_path(name text, op text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'storage', 'pg_catalog'
AS $function$
DECLARE
  _user_id UUID := auth.uid();
  _segments TEXT[];
  _prefix TEXT;
  _seg2 TEXT;
  _is_admin BOOLEAN;
  _my_household UUID;
  _sp_specialist UUID;
  _sp_linked_child UUID;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;

  SELECT is_admin INTO _is_admin FROM profiles WHERE id = _user_id;
  IF _is_admin AND op = 'SELECT' THEN RETURN true; END IF;

  _segments := storage.foldername(name);
  _prefix := _segments[1];
  _seg2 := _segments[2];

  -- Pattern A: inbox/{userId}/...
  IF _prefix = 'inbox' THEN
    RETURN _seg2 = _user_id::text;
  END IF;

  -- Pattern B: chat/{chatId}/...
  IF _prefix = 'chat' THEN
    IF op = 'DELETE' OR op = 'UPDATE' THEN RETURN false; END IF;
    RETURN EXISTS (
      SELECT 1 FROM chats
      WHERE id::text = _seg2
        AND participants @> to_jsonb(_user_id::text)
    );
  END IF;

  -- Patterns C and D: homework/{childId}/[exerciseId]/...
  IF _prefix = 'homework' THEN
    SELECT household_id INTO _my_household FROM profiles WHERE id = _user_id;
    IF EXISTS (SELECT 1 FROM children WHERE id::text = _seg2 AND household_id = _my_household) THEN
      RETURN true;
    END IF;
    RETURN EXISTS (
      SELECT 1 FROM folder_permissions
      WHERE specialist_id::text = _user_id::text
        AND child_id::text = _seg2
    );
  END IF;

  -- Pattern E: specialists/{specId}/...
  IF _prefix = 'specialists' THEN
    RETURN _seg2 = _user_id::text;
  END IF;

  -- Pattern G (NEW): spec_patient/{spec_patient_id}/...
  -- Owning specialist always passes. Post-merge, linked household
  -- members also pass.
  IF _prefix = 'spec_patient' THEN
    SELECT specialist_id, linked_child_id
      INTO _sp_specialist, _sp_linked_child
      FROM specialist_patients
      WHERE id::text = _seg2;
    IF _sp_specialist IS NULL THEN RETURN false; END IF;
    IF _sp_specialist = _user_id THEN RETURN true; END IF;
    IF _sp_linked_child IS NOT NULL THEN
      SELECT household_id INTO _my_household FROM profiles WHERE id = _user_id;
      IF _my_household IS NOT NULL AND EXISTS (
        SELECT 1 FROM children
        WHERE id = _sp_linked_child AND household_id = _my_household
      ) THEN RETURN true; END IF;
    END IF;
    RETURN false;
  END IF;

  -- Pattern F: {childId}/... (must come AFTER spec_patient since both
  -- have non-UUID-looking-first-segments handled above)
  IF _prefix ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT household_id INTO _my_household FROM profiles WHERE id = _user_id;
    IF EXISTS (SELECT 1 FROM children WHERE id::text = _prefix AND household_id = _my_household) THEN
      RETURN true;
    END IF;
    RETURN EXISTS (
      SELECT 1 FROM folder_permissions
      WHERE specialist_id::text = _user_id::text
        AND child_id::text = _prefix
    );
  END IF;

  RETURN false;
END $function$;

-- ───────────────────────────────────────────────────────────────────
-- VERIFY queries — paste after applying
-- ───────────────────────────────────────────────────────────────────
--
-- (1) folders column:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name='folders' AND column_name='specialist_patient_id';
--
-- (2) folders constraint:
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid='folders'::regclass AND conname='folders_patient_xor';
--
-- (3) files column:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name='files' AND column_name='specialist_patient_id';
--
-- (4) files constraint:
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid='files'::regclass AND conname='files_patient_xor';
--
-- (5) Both partial indexes:
--   SELECT indexname FROM pg_indexes
--   WHERE indexname IN ('idx_folders_spec_patient','idx_files_spec_patient');
--
-- (6) Updated function — smoke test with random UUID (expects false):
--   SELECT can_access_huddledin_path('spec_patient/' || gen_random_uuid() || '/test.png', 'SELECT');
--   Expected: false (random UUID means no matching specialist_patient row).
--
-- (7) Row count check (no rows lost):
--   SELECT COUNT(*) AS folders_count FROM folders;
--   SELECT COUNT(*) AS files_count FROM files;

-- ───────────────────────────────────────────────────────────────────
-- ROLLBACK (only if verification fails)
-- ───────────────────────────────────────────────────────────────────
--
-- (Reverts function to its pre-Pattern-G state. The original function
-- body from 20260512_huddledin_files_rls_tightening.sql is preserved
-- in that migration file.)
--
-- ALTER TABLE files DROP CONSTRAINT IF EXISTS files_patient_xor;
-- DROP INDEX IF EXISTS idx_files_spec_patient;
-- ALTER TABLE files DROP COLUMN IF EXISTS specialist_patient_id;
--
-- ALTER TABLE folders DROP CONSTRAINT IF EXISTS folders_patient_xor;
-- DROP INDEX IF EXISTS idx_folders_spec_patient;
-- ALTER TABLE folders DROP COLUMN IF EXISTS specialist_patient_id;
--
-- -- Restore can_access_huddledin_path to pre-Pattern-G shape:
-- (See 20260512_huddledin_files_rls_tightening.sql for original body.)
