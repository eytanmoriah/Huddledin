-- Account deletion functions — healthcare records retention compliant
-- Parent: anonymize children + selective delete. Specialist: two modes.

-- ═══════════════════════════════════════════════════════════════════
-- PARENT DELETION — anonymize children, keep specialist records
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION delete_parent_account(p_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _hh_id UUID;
BEGIN
  SELECT household_id INTO _hh_id FROM profiles WHERE id = p_user_id;

  -- 1. Anonymize children (keep IDs so specialist records still link)
  UPDATE children
    SET name = 'Archived Child', dob = NULL, avatar_emoji = '👤',
        photo_url = NULL, tz_number = NULL
    WHERE household_id = _hh_id;

  -- 2. Delete parent-owned data
  DELETE FROM parent_tasks WHERE household_id = _hh_id::text;
  DELETE FROM notifications WHERE user_id = p_user_id;
  DELETE FROM seen_timestamps WHERE user_id = p_user_id;
  DELETE FROM household_invites WHERE invited_by = p_user_id;
  DELETE FROM invites WHERE parent_id = p_user_id;
  DELETE FROM connection_codes WHERE parent_id = p_user_id;
  DELETE FROM subscriptions WHERE user_id = p_user_id;
  -- Inbox files only (uploaded by parent, no child assigned)
  DELETE FROM files WHERE uploaded_by = p_user_id AND child_id IS NULL;
  -- Messages sent by parent (specialist messages kept for clinical records)
  DELETE FROM messages WHERE sender_id = p_user_id;

  -- 3. Anonymize shared data
  UPDATE chats
    SET participants = array_remove(participants, p_user_id::text),
        unread_for = array_remove(unread_for, p_user_id::text)
    WHERE household_id = _hh_id;
  UPDATE specialist_requests
    SET status = 'archived', parent_id = NULL
    WHERE parent_id = p_user_id;
  UPDATE appointments
    SET parent_id = NULL
    WHERE parent_id = p_user_id;

  -- 4. Promote co-parent to primary if one exists
  UPDATE profiles SET is_primary = true
  WHERE id = (
    SELECT id FROM profiles
    WHERE household_id = _hh_id AND id != p_user_id AND role = 'parent'
    ORDER BY created_at LIMIT 1
  );

  -- 5. Delete profile
  DELETE FROM profiles WHERE id = p_user_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- SPECIALIST DELETION — keep records for families (anonymize identity)
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION delete_specialist_keep_records(p_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 1. Clinical records: keep content, keep specialist_name for attribution
  --    Only null out specialist_id FK so auth deletion doesn't cascade
  UPDATE vault_notes SET specialist_id = NULL WHERE specialist_id = p_user_id;
  UPDATE reports SET specialist_id = NULL WHERE specialist_id = p_user_id;
  UPDATE homework_tasks SET specialist_id = NULL WHERE specialist_id = p_user_id;
  UPDATE appointments SET specialist_id = NULL WHERE specialist_id = p_user_id;
  -- Messages: keep text, keep sender_name for attribution
  UPDATE messages SET sender_id = NULL WHERE sender_id = p_user_id;

  -- 2. Archive specialist requests
  UPDATE specialist_requests SET status = 'archived' WHERE specialist_id = p_user_id;

  -- 3. Remove from chats
  UPDATE chats
    SET participants = array_remove(participants, p_user_id::text)
    WHERE participants @> ARRAY[p_user_id::text];

  -- 4. Delete specialist-owned data
  DELETE FROM notifications WHERE user_id = p_user_id;
  DELETE FROM seen_timestamps WHERE user_id = p_user_id;
  DELETE FROM folder_permissions WHERE specialist_id = p_user_id::text;
  DELETE FROM subscriptions WHERE user_id = p_user_id;
  DELETE FROM spec_vault_files WHERE specialist_id = p_user_id;
  DELETE FROM spec_vault_folders WHERE specialist_id = p_user_id;
  DELETE FROM report_templates WHERE specialist_id = p_user_id;
  DELETE FROM report_settings WHERE specialist_id = p_user_id;
  DELETE FROM spec_tasks WHERE specialist_id = p_user_id;

  -- 5. Delete profile
  DELETE FROM specialists WHERE id = p_user_id;
  DELETE FROM profiles WHERE id = p_user_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- SPECIALIST DELETION — delete everything including clinical records
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION delete_specialist_with_records(p_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 1. Delete all clinical records
  DELETE FROM vault_notes WHERE specialist_id = p_user_id;
  DELETE FROM reports WHERE specialist_id = p_user_id;
  DELETE FROM homework_occurrences WHERE task_id IN (
    SELECT id FROM homework_tasks WHERE specialist_id = p_user_id
  );
  DELETE FROM homework_completions WHERE task_id IN (
    SELECT id FROM homework_tasks WHERE specialist_id = p_user_id
  );
  DELETE FROM homework_tasks WHERE specialist_id = p_user_id;
  DELETE FROM messages WHERE sender_id = p_user_id;
  DELETE FROM appointments WHERE specialist_id = p_user_id AND created_by = p_user_id;

  -- 2. Archive/clean specialist requests
  DELETE FROM specialist_requests WHERE specialist_id = p_user_id;
  DELETE FROM folder_permissions WHERE specialist_id = p_user_id::text;

  -- 3. Remove from chats
  UPDATE chats
    SET participants = array_remove(participants, p_user_id::text)
    WHERE participants @> ARRAY[p_user_id::text];

  -- 4. Delete all specialist data
  DELETE FROM notifications WHERE user_id = p_user_id;
  DELETE FROM seen_timestamps WHERE user_id = p_user_id;
  DELETE FROM subscriptions WHERE user_id = p_user_id;
  DELETE FROM spec_vault_files WHERE specialist_id = p_user_id;
  DELETE FROM spec_vault_folders WHERE specialist_id = p_user_id;
  DELETE FROM report_templates WHERE specialist_id = p_user_id;
  DELETE FROM report_settings WHERE specialist_id = p_user_id;
  DELETE FROM spec_tasks WHERE specialist_id = p_user_id;

  -- 5. Delete profile
  DELETE FROM specialists WHERE id = p_user_id;
  DELETE FROM profiles WHERE id = p_user_id;
END;
$$;
