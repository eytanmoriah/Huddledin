-- ═══════════════════════════════════════════════
-- FIX 1: CHATS — Remove open policy, add scoped
-- ═══════════════════════════════════════════════

-- Drop the wide-open policy
DROP POLICY IF EXISTS "authenticated access" ON chats;

-- SELECT: user is a participant OR in the household
CREATE POLICY "chats_select" ON chats FOR SELECT TO authenticated
USING (
  participants @> to_jsonb(auth.uid()::text)
  OR household_id = get_my_household_id()
);

-- INSERT: user must be in the participants array they're creating
CREATE POLICY "chats_insert" ON chats FOR INSERT TO authenticated
WITH CHECK (
  participants @> to_jsonb(auth.uid()::text)
);

-- UPDATE: user is a participant OR in the household
-- (covers unread_for updates by participants + participant list changes by parents)
CREATE POLICY "chats_update" ON chats FOR UPDATE TO authenticated
USING (
  participants @> to_jsonb(auth.uid()::text)
  OR household_id = get_my_household_id()
);

-- DELETE: household parents only (no client code deletes chats, but restrict anyway)
CREATE POLICY "chats_delete" ON chats FOR DELETE TO authenticated
USING (
  household_id = get_my_household_id()
);

-- Drop the redundant household-only update (now covered by chats_update)
DROP POLICY IF EXISTS "household_members_update_chats" ON chats;


-- ═══════════════════════════════════════════════
-- FIX 2: SUBSCRIPTIONS — Remove client UPDATE
-- ═══════════════════════════════════════════════

-- Drop the update policy that lets users set their own status
DROP POLICY IF EXISTS "subscriptions_update" ON subscriptions;

-- No replacement needed. Only the Paddle webhook (via service_role key)
-- should update subscription rows.
