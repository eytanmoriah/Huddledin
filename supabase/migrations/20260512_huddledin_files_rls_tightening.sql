-- ═══════════════════════════════════════════════════════════════════
-- huddledin-files RLS Tightening Migration
-- Date: 2026-05-12
-- Audit: Report 06 #17 (no migration for bucket) + Report 06 #7 (open RLS)
-- Design: audit-2026-05-10/fix-07-storage-access-model-design.md
-- ═══════════════════════════════════════════════════════════════════
--
-- Background
-- ----------
-- Storage policies on huddledin-files were too permissive. Any authenticated
-- user could read/write/delete any file regardless of relationship to the
-- file's child, household, or chat. Anonymous access was already blocked by
-- bucket public:false.
--
-- This migration introduces a unified SECURITY DEFINER helper function and
-- 4 path-scoped policies. Six path patterns dispatched by storage.foldername:
--   A. inbox/{userId}/...          — self only
--   B. chat/{chatId}/...           — participant for SELECT/INSERT
--   C. homework/{childId}/...      — household or permitted specialist
--   D. homework/{childId}/{exId}/  — same as C (same childId scoping)
--   E. specialists/{specId}/...    — self only (admin SELECT)
--   F. {childId}/...               — same as C (vault folder files)
--
-- Universal owner-delete backstop on the DELETE policy: every uploader can
-- always delete their own files regardless of path. The helper's chat branch
-- returns false for DELETE/UPDATE; the backstop handles owner-only chat
-- photo deletes.
--
-- Cleanup bundled
-- ---------------
-- - 4 vestigial anon-JPG policies for non-existent 'public/' folder prefix.
-- - Orphan 'Huddledin files' bucket (capital H, public=true, confirmed 0 rows).
--
-- Apply procedure (manual via Supabase SQL Editor per Golden Rule #11)
-- ----------------------------------------------------------------------
--   Phase A: indexes + helper + new policies (alongside existing).
--   VERIFY:  paste verification queries to confirm both old + new active.
--   Phase B: drop existing too-permissive + vestigial JPG + orphan bucket.
--   LIVE VERIFY: run fix-07 Section 11 verification matrix from live app.
--   If anything fails: run rollback block at bottom.
--
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- PHASE A: CREATE
-- Run this block first. Old policies remain active alongside new ones —
-- because Postgres RLS is permissive-OR by default, behavior in this
-- window is unchanged (old policies still allow). Use the VERIFY block
-- below before proceeding to Phase B.
-- ───────────────────────────────────────────────────────────────────

-- A1. Indexes — prerequisites for helper performance.
CREATE INDEX IF NOT EXISTS chats_participants_gin
  ON chats USING GIN (participants);

CREATE INDEX IF NOT EXISTS folder_permissions_specialist_child_idx
  ON folder_permissions (specialist_id, child_id, status);


-- A2. Unified path-based access helper.
-- Returns true if calling user can perform `op` on `name` in huddledin-files.
-- op is one of: 'SELECT', 'INSERT', 'UPDATE', 'DELETE'.
-- Chat DELETE/UPDATE returns false here — the DELETE policy's owner backstop
-- handles owner-only chat-photo deletes; chat UPDATE is denied universally
-- (no app flow performs storage UPDATE on chat photos; they're append-only).
CREATE OR REPLACE FUNCTION can_access_huddledin_path(name TEXT, op TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_catalog
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _segments TEXT[];
  _prefix TEXT;
  _seg2 TEXT;
  _is_admin BOOLEAN;
  _my_household UUID;
BEGIN
  -- Anonymous always denied (defense-in-depth; bucket public=false already handles it).
  IF _user_id IS NULL THEN RETURN false; END IF;

  -- Admin: read-only across all paths. No write.
  SELECT is_admin INTO _is_admin FROM profiles WHERE id = _user_id;
  IF _is_admin AND op = 'SELECT' THEN RETURN true; END IF;

  _segments := storage.foldername(name);
  _prefix := _segments[1];
  _seg2 := _segments[2];

  -- Pattern A: inbox/{userId}/...  — self only.
  IF _prefix = 'inbox' THEN
    RETURN _seg2 = _user_id::text;
  END IF;

  -- Pattern B: chat/{chatId}/...  — participant for SELECT/INSERT only.
  -- DELETE/UPDATE return false; the DELETE policy's owner backstop
  -- restricts deletes to the original uploader.
  IF _prefix = 'chat' THEN
    IF op = 'DELETE' OR op = 'UPDATE' THEN RETURN false; END IF;
    RETURN EXISTS (
      SELECT 1 FROM chats
      WHERE id::text = _seg2
        AND participants @> to_jsonb(_user_id::text)
    );
  END IF;

  -- Patterns C and D: homework/{childId}/[exerciseId]/...
  -- Household match OR specialist with approved folder_permission.
  IF _prefix = 'homework' THEN
    SELECT household_id INTO _my_household FROM profiles WHERE id = _user_id;
    IF EXISTS (SELECT 1 FROM children WHERE id::text = _seg2 AND household_id = _my_household) THEN
      RETURN true;
    END IF;
    RETURN EXISTS (
      SELECT 1 FROM folder_permissions
      WHERE specialist_id::text = _user_id::text
        AND child_id::text = _seg2
        AND status = 'approved'
    );
  END IF;

  -- Pattern E: specialists/{specId}/...  — self only (admin SELECT handled above).
  IF _prefix = 'specialists' THEN
    RETURN _seg2 = _user_id::text;
  END IF;

  -- Pattern F: {childId}/...  — first segment is childId (no recognized prefix).
  -- Same access as Patterns C/D.
  IF _prefix ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT household_id INTO _my_household FROM profiles WHERE id = _user_id;
    IF EXISTS (SELECT 1 FROM children WHERE id::text = _prefix AND household_id = _my_household) THEN
      RETURN true;
    END IF;
    RETURN EXISTS (
      SELECT 1 FROM folder_permissions
      WHERE specialist_id::text = _user_id::text
        AND child_id::text = _prefix
        AND status = 'approved'
    );
  END IF;

  -- Unknown path shape — deny.
  RETURN false;
END $$;

GRANT EXECUTE ON FUNCTION can_access_huddledin_path(TEXT, TEXT) TO authenticated, service_role;


-- A3. New policies — run alongside existing too-permissive policies.

CREATE POLICY "huddledin_files_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'huddledin-files'
  AND can_access_huddledin_path(name, 'SELECT')
);

CREATE POLICY "huddledin_files_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'huddledin-files'
  AND can_access_huddledin_path(name, 'INSERT')
);

CREATE POLICY "huddledin_files_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'huddledin-files'
  AND can_access_huddledin_path(name, 'UPDATE')
)
WITH CHECK (
  bucket_id = 'huddledin-files'
  AND can_access_huddledin_path(name, 'UPDATE')
);

-- DELETE policy has the universal owner backstop: every uploader can always
-- delete their own files regardless of path. This handles chat-photo deletes
-- (helper's chat branch returns false; owner backstop allows uploader).
CREATE POLICY "huddledin_files_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'huddledin-files'
  AND (can_access_huddledin_path(name, 'DELETE') OR owner = auth.uid())
);


-- ───────────────────────────────────────────────────────────────────
-- VERIFY — paste in SQL editor between Phase A and Phase B.
-- ───────────────────────────────────────────────────────────────────
--
-- (1) Confirm 4 new policies exist alongside whatever existing policies
--     yesterday's Q2 surfaced. Expect 4 huddledin_files_* rows plus the
--     pre-existing too-permissive policies (mix of old + new names).
--
--   SELECT policyname, cmd, roles, qual, with_check
--   FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects'
--   ORDER BY policyname;
--
-- (2) Confirm helper function exists with SECURITY DEFINER.
--
--   SELECT routine_name, security_type
--   FROM information_schema.routines
--   WHERE routine_schema = 'public' AND routine_name = 'can_access_huddledin_path';
--
-- (3) Confirm both new indexes exist.
--
--   SELECT indexname FROM pg_indexes
--   WHERE (tablename = 'chats' AND indexname = 'chats_participants_gin')
--      OR (tablename = 'folder_permissions' AND indexname = 'folder_permissions_specialist_child_idx');
--


-- ───────────────────────────────────────────────────────────────────
-- PHASE B: DROP
-- Run only after Phase A verification passes. This is the step that
-- tightens access. Immediately after, run the live verification matrix
-- from fix-07 Section 11.
-- ───────────────────────────────────────────────────────────────────
--
-- IMPORTANT — Eytan: replace the placeholder policy names below with the
-- verbatim names from yesterday's Q2 results before running this block.
-- The pre-existing policies are named something like "Authenticated users
-- can SELECT" / "INSERT" / "UPDATE" / "DELETE" — whatever the dashboard
-- surfaced them as.

-- B1. Drop the existing too-permissive policies (replace names from Q2 results):
DROP POLICY IF EXISTS "allow public reads" ON storage.objects;
DROP POLICY IF EXISTS "allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "allow authenticated deletes" ON storage.objects;

-- B2. Drop the 4 vestigial anon-JPG policies. These were dashboard-created
-- for a public-folder share that no longer exists. Replace names from Q2.
DROP POLICY IF EXISTS "Give anon users access to JPG images in folder 1c1igrx_0" ON storage.objects;
DROP POLICY IF EXISTS "Give anon users access to JPG images in folder 1c1igrx_1" ON storage.objects;
DROP POLICY IF EXISTS "Give anon users access to JPG images in folder 1c1igrx_2" ON storage.objects;
DROP POLICY IF EXISTS "Give anon users access to JPG images in folder 1c1igrx_3" ON storage.objects;

-- B3. Drop the orphan 'Huddledin files' bucket (capital H, public=true,
-- confirmed empty by Eytan).
DELETE FROM storage.buckets WHERE id = 'Huddledin files';


-- ───────────────────────────────────────────────────────────────────
-- LIVE VERIFICATION
-- After Phase B, run fix-07 Section 11 verification matrix from the live
-- app. 16 positive flows + 4 negative flows. ALL must pass.
-- If any flow regresses, run the rollback block below.
-- ───────────────────────────────────────────────────────────────────


-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK — only run if Phase B verification fails.
-- Pre-draft: Eytan pastes the verbatim policy bodies from yesterday's
-- Q2 results into the CREATE POLICY blocks below BEFORE running.
-- ═══════════════════════════════════════════════════════════════════
--
-- -- Step 1: drop the new policies.
-- DROP POLICY IF EXISTS "huddledin_files_select" ON storage.objects;
-- DROP POLICY IF EXISTS "huddledin_files_insert" ON storage.objects;
-- DROP POLICY IF EXISTS "huddledin_files_update" ON storage.objects;
-- DROP POLICY IF EXISTS "huddledin_files_delete" ON storage.objects;
--
-- -- Step 2: drop the helper function. Optional — leaving harmless.
-- DROP FUNCTION IF EXISTS can_access_huddledin_path(TEXT, TEXT);
--
-- -- Step 3: recreate the old too-permissive policies (verbatim from Q2).
--
-- CREATE POLICY "allow public reads"
-- ON storage.objects FOR SELECT TO public
-- USING (bucket_id = 'huddledin-files');
--
-- CREATE POLICY "allow authenticated uploads"
-- ON storage.objects FOR INSERT TO authenticated
-- WITH CHECK (bucket_id = 'huddledin-files');
--
-- CREATE POLICY "allow authenticated deletes"
-- ON storage.objects FOR DELETE TO authenticated
-- USING (bucket_id = 'huddledin-files');
--
-- -- Indexes added in Phase A are harmless — leave them in place.
-- -- Vestigial anon-JPG policies were already useless; don't recreate.
-- -- Orphan 'Huddledin files' bucket was empty; don't recreate.
--
-- ═══════════════════════════════════════════════════════════════════
