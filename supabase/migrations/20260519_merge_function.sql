-- ═══════════════════════════════════════════════════════════════════
-- merge_specialist_patient_into_child function
-- Date: 2026-05-19
-- Design: audit-2026-05-10/fix-17-merge-function-investigation.md
-- Sub-commit: 6 of N for the pre-parent-patients arc
-- ═══════════════════════════════════════════════════════════════════
--
-- Atomically transitions a pre-parent patient's clinical history to a
-- connected child. Migrates vault_notes, appointments, reports,
-- folders, files via FK flip. Inserts folder_permissions grants for
-- the specialist. Promotes pending_publish notes and pending_share
-- reports to live state. Updates specialist_patients.status='linked'.
--
-- intake_responses NOT touched — stays anchored to specialist_patient_id
-- forever per Sub-commit 5's design lock.
--
-- Files' storage_path values UNCHANGED. Storage RLS Pattern G (4g)
-- handles post-merge access via specialist_patients.linked_child_id.
--
-- Authorization: caller must own the spec_patient AND have an approved
-- specialist_request for the target child. Postgres defaults EXECUTE to
-- PUBLIC; REVOKE statements after the GRANT tighten access to
-- authenticated only (service_role + anon + PUBLIC all revoked).
--
-- Advisory lock ensures concurrent merge attempts on the same pre-parent
-- serialize. Idempotent re-call returns already_linked status with
-- current state.
--
-- Note on folder_permissions (Step F): the table has NO status column.
-- A row's existence IS the permission grant; revocation is a DELETE.
-- This matches the May 12 storage RLS tightening design.
--
-- Note on updated_at columns: vault_notes, appointments, and files do NOT
-- have updated_at columns. Only reports and specialist_patients do.
-- Steps A/B/E UPDATEs omit updated_at; Steps C/G preserve it.
-- (First end-to-end merge test on May 19 caught this — Sub-commit 6.2 fix.)
--
-- Apply manually via Supabase SQL Editor per Golden Rule #11.

CREATE OR REPLACE FUNCTION public.merge_specialist_patient_into_child(
  p_spec_patient_id UUID,
  p_child_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  _caller UUID := auth.uid();
  _sp specialist_patients%ROWTYPE;
  _child children%ROWTYPE;
  _has_request_access BOOLEAN := false;
  _notes_count INT := 0;
  _appts_count INT := 0;
  _reports_count INT := 0;
  _folders_count INT := 0;
  _files_count INT := 0;
  _perms_count INT := 0;
  _folder_keys TEXT[];
  _linked_at TIMESTAMPTZ;
BEGIN
  -- ─── Pre-flight (a): authenticated ───────────────────────────
  IF _caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  -- ─── Pre-flight (b): advisory lock ──────────────────────────
  -- Serialize concurrent merge attempts on the same pre-parent.
  PERFORM pg_advisory_xact_lock(
    hashtext('merge_spec_patient_' || p_spec_patient_id::text)
  );

  -- ─── Pre-flight (c): spec_patient exists + owned by caller ──
  SELECT * INTO _sp FROM specialist_patients WHERE id = p_spec_patient_id;
  IF _sp.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'spec_patient_not_found');
  END IF;
  IF _sp.specialist_id <> _caller THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  IF _sp.status = 'archived' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'archived_patient');
  END IF;

  -- ─── Pre-flight (d): idempotency check ──────────────────────
  IF _sp.status = 'linked' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_linked', true,
      'specialist_patient_id', _sp.id,
      'child_id', _sp.linked_child_id,
      'linked_at', _sp.linked_at
    );
  END IF;

  -- ─── Pre-flight (e): defensive linked_child_id check ────────
  IF _sp.linked_child_id IS NOT NULL AND _sp.linked_child_id <> p_child_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_linked_to_different_child');
  END IF;

  -- ─── Pre-flight (f): child exists ────────────────────────────
  SELECT * INTO _child FROM children WHERE id = p_child_id;
  IF _child.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'child_not_found');
  END IF;

  -- ─── Pre-flight (g): caller has approved access to child ────
  -- CRITICAL SECURITY CHECK: prevents merging into unrelated children.
  SELECT EXISTS (
    SELECT 1 FROM specialist_requests
    WHERE specialist_id = _caller
      AND child_id = p_child_id
      AND request_type = 'join'
      AND status = 'approved'
  ) INTO _has_request_access;
  IF NOT _has_request_access THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized_for_child');
  END IF;

  _linked_at := NOW();

  -- ═══ Step A: vault_notes ════════════════════════════════════
  WITH updated AS (
    UPDATE vault_notes
    SET child_id = p_child_id,
        specialist_patient_id = NULL,
        published = CASE WHEN pending_publish THEN true ELSE published END,
        pending_publish = false,
        household_id = _child.household_id
    WHERE specialist_patient_id = p_spec_patient_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO _notes_count FROM updated;

  -- ═══ Step B: appointments ═══════════════════════════════════
  WITH updated AS (
    UPDATE appointments
    SET child_id = p_child_id,
        specialist_patient_id = NULL,
        household_id = _child.household_id,
        parent_id = _child.parent_id
    WHERE specialist_patient_id = p_spec_patient_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO _appts_count FROM updated;

  -- ═══ Step C: reports ════════════════════════════════════════
  WITH updated AS (
    UPDATE reports
    SET child_id = p_child_id,
        specialist_patient_id = NULL,
        shared_with_parents = CASE WHEN pending_share THEN true ELSE shared_with_parents END,
        shared_at = CASE WHEN pending_share AND shared_at IS NULL THEN _linked_at ELSE shared_at END,
        pending_share = false,
        updated_at = _linked_at
    WHERE specialist_patient_id = p_spec_patient_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO _reports_count FROM updated;

  -- ═══ Step D: folders ════════════════════════════════════════
  WITH updated AS (
    UPDATE folders
    SET child_id = p_child_id,
        specialist_patient_id = NULL
    WHERE specialist_patient_id = p_spec_patient_id
    RETURNING key
  )
  SELECT array_agg(key), COUNT(*) INTO _folder_keys, _folders_count FROM updated;

  -- ═══ Step E: files ══════════════════════════════════════════
  -- storage_path values UNCHANGED. Pattern G in storage RLS handles
  -- parent access via linked_child_id (set in Step G).
  WITH updated AS (
    UPDATE files
    SET child_id = p_child_id,
        specialist_patient_id = NULL
    WHERE specialist_patient_id = p_spec_patient_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO _files_count FROM updated;

  -- ═══ Step F: folder_permissions ═════════════════════════════
  -- INSERT specialist grants for each migrated folder. Composite PK
  -- (specialist_id, child_id, folder_key) handles dedup via ON CONFLICT.
  -- Note: folder_permissions has NO status column — the row's existence
  -- IS the permission grant; revocation is a DELETE (per the May 12
  -- storage RLS tightening investigation).
  IF _folder_keys IS NOT NULL AND array_length(_folder_keys, 1) > 0 THEN
    INSERT INTO folder_permissions (specialist_id, child_id, folder_key, granted_at)
    SELECT _caller::text, p_child_id, unnest(_folder_keys), _linked_at
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS _perms_count = ROW_COUNT;
  END IF;

  -- ═══ Step G: specialist_patients (the link itself) ══════════
  -- LAST step. Sets status='linked' which Pattern G in storage RLS
  -- then reads, granting parent household access to spec_patient/<id>/...
  UPDATE specialist_patients
  SET status = 'linked',
      linked_child_id = p_child_id,
      linked_at = _linked_at,
      updated_at = _linked_at
  WHERE id = p_spec_patient_id;

  -- ─── Step H: intake_responses (NOT TOUCHED) ─────────────────
  -- Stays anchored to specialist_patient_id forever per Sub-commit 5.

  -- ─── Return summary ─────────────────────────────────────────
  RETURN jsonb_build_object(
    'ok', true,
    'specialist_patient_id', p_spec_patient_id,
    'child_id', p_child_id,
    'linked_at', _linked_at,
    'migrated', jsonb_build_object(
      'vault_notes', _notes_count,
      'appointments', _appts_count,
      'reports', _reports_count,
      'folders', _folders_count,
      'files', _files_count,
      'folder_permissions_inserted', _perms_count
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_specialist_patient_into_child(UUID, UUID)
  TO authenticated;

-- Postgres defaults EXECUTE to PUBLIC on new functions. Revoke from
-- everyone else to enforce the auth-only design (service_role is
-- explicitly NOT granted access; the in-function auth.uid() guard
-- catches anon/service_role calls regardless, but tightening grants
-- surfaces the error at the API layer instead of silent guard
-- failure).
REVOKE EXECUTE ON FUNCTION public.merge_specialist_patient_into_child(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.merge_specialist_patient_into_child(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.merge_specialist_patient_into_child(UUID, UUID) FROM service_role;

-- service_role NOT granted execute. Future admin tooling can add a
-- separate explicit-admin-auth function if needed.

-- ───────────────────────────────────────────────────────────────────
-- VERIFY queries — paste after applying
-- ───────────────────────────────────────────────────────────────────
--
-- (1) Function exists with right signature:
--   SELECT routine_name, security_type
--   FROM information_schema.routines
--   WHERE routine_name='merge_specialist_patient_into_child';
--   Expected: 1 row, security_type='DEFINER'.
--
-- (2) Grant correct:
--   SELECT grantee, privilege_type
--   FROM information_schema.routine_privileges
--   WHERE routine_name='merge_specialist_patient_into_child';
--   Expected: 'authenticated' has 'EXECUTE'. NOT 'service_role'.
--
-- (3) Smoke test — call with non-existent IDs (should NOT execute as
--   authenticated would fail auth.uid()=NULL; manual SQL editor runs
--   as postgres so this returns 'unauthenticated' which is the safety
--   net):
--   SELECT merge_specialist_patient_into_child(
--     gen_random_uuid(),
--     gen_random_uuid()
--   );
--   Expected: { "ok": false, "error": "unauthenticated" }.
--   (This confirms the auth.uid() guard works — running as postgres
--   in SQL editor has NULL auth.uid().)
--
-- NOTE: a full integration smoke test (auth as specialist eytan760,
-- create a pre-parent patient, merge into Erez) requires the matching
-- UI from Sub-commit 7 OR a manual frontend test via console. Defer.

-- ───────────────────────────────────────────────────────────────────
-- ROLLBACK (only if verification fails)
-- ───────────────────────────────────────────────────────────────────
--
-- DROP FUNCTION IF EXISTS public.merge_specialist_patient_into_child(UUID, UUID);
