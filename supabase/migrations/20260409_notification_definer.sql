-- ═══════════════════════════════════════════════
-- Security Definer function for cross-user notification upsert
-- Replaces client-side _upsertNotif which needed open RLS
-- ═══════════════════════════════════════════════

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
    UPDATE notifications SET
      message = _counted_msg, meta_count = _new_count,
      created_at = now(), link_data = COALESCE(p_link_data, link_data)
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


-- ═══════════════════════════════════════════════
-- RLS: Remove open policy, add scoped DELETE
-- ═══════════════════════════════════════════════

DROP POLICY IF EXISTS "authenticated access" ON notifications;

CREATE POLICY "delete_own_notifications" ON notifications FOR DELETE TO authenticated
USING (user_id = auth.uid());
