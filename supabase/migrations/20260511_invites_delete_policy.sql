-- 2026-05-11: Add DELETE policy to invites table.
--
-- Cancel Invite button (Care Team page) was silently broken since the
-- invites table was created: RLS was enabled with SELECT/INSERT/UPDATE
-- policies but no DELETE policy. Default-deny meant every cancel attempt
-- silently filtered to zero rows and returned 204, leaving the row in
-- the DB while the UI optimistically removed it. Refresh re-added the
-- ghost row.
--
-- This file documents the policy applied manually via the Supabase
-- dashboard. Already live in production.

CREATE POLICY "Parents can delete their invites"
ON invites
FOR DELETE
TO authenticated
USING (parent_id = auth.uid());
