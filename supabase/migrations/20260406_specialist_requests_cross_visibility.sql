-- Allow specialists to see other specialists connected to the same child
-- Needed for: consultation modal, care team display, chat participant lookup
--
-- Current policy only allows: specialist_id = auth.uid() OR parent_id = auth.uid() OR household match
-- This means Specialist A cannot see Specialist B's row even if both are approved for the same child
--
-- Fix: add EXISTS clause so approved specialists on a child can see each other's rows

-- Drop the existing SELECT policy (name may vary — try both known names)
DROP POLICY IF EXISTS "Parents can select requests by email hint" ON specialist_requests;
DROP POLICY IF EXISTS "specialist_requests_select" ON specialist_requests;
DROP POLICY IF EXISTS "specialists_select_own" ON specialist_requests;

-- Recreate with cross-visibility for specialists on the same child
CREATE POLICY "specialist_requests_select" ON specialist_requests FOR SELECT
USING (
  specialist_id = auth.uid()
  OR parent_id = auth.uid()
  OR household_id = get_my_household_id()::text
  OR (parent_email_hint = auth.email() AND status = 'pending')
  OR EXISTS (
    SELECT 1 FROM specialist_requests my
    WHERE my.specialist_id = auth.uid()
    AND my.child_id = specialist_requests.child_id
    AND my.status = 'approved'
  )
);
