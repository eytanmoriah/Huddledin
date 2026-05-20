-- ═══════════════════════════════════════════════════════════════════
-- upsert_notification: UPDATE branch now refreshes link_tab
-- Date: 2026-05-20
-- Sub-commit: 10.1 (hotfix on Sub-commit 10's share-to-files flow)
-- ═══════════════════════════════════════════════════════════════════
--
-- Sub-commit 10's report-share notification fired with linkTab='files'
-- but the parent landed on the Notes tab (link_tab='session-summaries')
-- when tapping it. Root cause: NOT the JS layer (notifyOtherParty's
-- precedence is already correct — explicit linkTab wins via the
-- `if(!linkTab)` guard). The bug is in this function's UPDATE/merge
-- branch.
--
-- When a new notification merges into an existing unread one of the
-- same (user_id, type, child_id), the UPDATE refreshed message,
-- meta_count, created_at, and link_data — but NEVER link_tab. So a
-- prior vault_notes publish (type='report', linkTab='session-summaries')
-- would leave its link_tab in place even when the merging notification
-- specified linkTab='files'.
--
-- Fix: add `link_tab = COALESCE(p_link_tab, link_tab)` to the UPDATE
-- branch's SET clause. Semantics:
--   - Caller passes non-NULL link_tab → propagates (overwrites stale)
--   - Caller passes NULL link_tab → unchanged (no caller-intent override)
-- The JS-side autoTab fallback at notifyOtherParty:7226-7228 already
-- resolves NULL → derived tab BEFORE calling _upsertNotif, so by the
-- time we get here, NULL means "caller had no opinion." Safe semantics.
--
-- Original function body from 20260409_notification_definer.sql. Only
-- one line added (in the IF _existing.id IS NOT NULL UPDATE block).
--
-- Apply manually via Supabase SQL Editor per Golden Rule #11.

DROP FUNCTION IF EXISTS upsert_notification(UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS upsert_notification(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT);

CREATE FUNCTION upsert_notification(
  p_user_id TEXT,
  p_type TEXT,
  p_message TEXT,
  p_stack_message TEXT DEFAULT NULL,
  p_child_id UUID DEFAULT NULL,
  p_household_id TEXT DEFAULT NULL,
  p_link_tab TEXT DEFAULT NULL,
  p_link_data TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing RECORD;
  _new_count INT;
  _counted_msg TEXT;
  _caller UUID := auth.uid();
  _recipient UUID := p_user_id::uuid;
  _is_authorized BOOLEAN := false;
BEGIN
  IF EXISTS (
    SELECT 1 FROM profiles p1
    JOIN profiles p2 ON p1.household_id = p2.household_id
    WHERE p1.id = _caller AND p2.id = _recipient
    AND p1.household_id IS NOT NULL
  ) THEN _is_authorized := true;
  ELSIF EXISTS (
    SELECT 1 FROM specialist_requests sr
    JOIN profiles p ON p.household_id = sr.household_id::uuid
    WHERE sr.specialist_id = _caller
    AND sr.status IN ('approved','pending')
    AND p.id = _recipient
  ) THEN _is_authorized := true;
  ELSIF EXISTS (
    SELECT 1 FROM specialist_requests sr
    WHERE sr.specialist_id = _recipient
    AND sr.status IN ('approved','pending')
    AND (sr.parent_id = _caller OR sr.household_id = (SELECT p3.household_id::text FROM profiles p3 WHERE p3.id = _caller LIMIT 1))
  ) THEN _is_authorized := true;
  ELSIF _caller = _recipient THEN _is_authorized := true;
  END IF;

  IF NOT _is_authorized THEN
    RAISE EXCEPTION 'Not authorized to notify this user';
  END IF;

  SELECT id, meta_count INTO _existing
    FROM notifications
    WHERE user_id = _recipient
      AND type = p_type
      AND read = false
      AND COALESCE(child_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(p_child_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ORDER BY created_at DESC
    LIMIT 1;

  IF _existing.id IS NOT NULL THEN
    _new_count := COALESCE(_existing.meta_count, 1) + 1;
    IF p_stack_message IS NOT NULL THEN
      _counted_msg := replace(p_stack_message, '{n}', _new_count::text);
    ELSE
      _counted_msg := p_message || ' (+' || (_new_count - 1)::text || ' more)';
    END IF;
    -- Sub-commit 10.1: refresh link_tab on merge so a new notification with a
    -- different deep-link target overrides the stale value from the existing row.
    -- COALESCE preserves the prior value when caller passes NULL (no override intent).
    UPDATE notifications SET
      message = _counted_msg, meta_count = _new_count,
      created_at = now(),
      link_tab = COALESCE(p_link_tab, link_tab),
      link_data = COALESCE(p_link_data, link_data)
    WHERE id = _existing.id;
  ELSE
    INSERT INTO notifications (id, user_id, household_id, child_id, type, message, read, link_tab, link_data, meta_count, created_at)
    VALUES (
      'n_op_' || extract(epoch from now())::bigint || '_' || p_user_id,
      _recipient, p_household_id::uuid, p_child_id, p_type, p_message,
      false, p_link_tab, p_link_data, 1, now()
    );
  END IF;

  DELETE FROM notifications WHERE id IN (
    SELECT id FROM notifications
    WHERE user_id = _recipient
    ORDER BY created_at DESC OFFSET 50
  );
END;
$$;

-- ───────────────────────────────────────────────────────────────────
-- VERIFY queries — paste after applying
-- ───────────────────────────────────────────────────────────────────
--
-- (1) Function exists with the expected signature:
--   SELECT routine_name, routine_type, security_type
--   FROM information_schema.routines
--   WHERE routine_name = 'upsert_notification';
--   Expected: 1 row, FUNCTION, DEFINER.
--
-- (2) Function body contains the new link_tab line:
--   SELECT pg_get_functiondef(oid) AS body
--   FROM pg_proc
--   WHERE proname = 'upsert_notification';
--   Expected: body includes `link_tab = COALESCE(p_link_tab, link_tab)`.
--
-- (3) End-to-end smoke (only run if you can spare a test row):
--   After applying, fire a notifyOtherParty('report', ..., 'files', ...) from
--   the specialist tab and verify the resulting notifications.link_tab='files',
--   even if a prior unread type='report' notification exists for the same
--   (user, child). On second fire the merge branch runs; link_tab should
--   propagate to 'files' instead of preserving the earlier value.

-- ───────────────────────────────────────────────────────────────────
-- ROLLBACK (only if verification fails)
-- ───────────────────────────────────────────────────────────────────
-- Re-apply 20260409_notification_definer.sql verbatim to restore the
-- prior body. No other tables / rows touched by this migration.
