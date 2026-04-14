-- Allow specialists to delete their OWN unpublished draft notes
-- Published notes remain protected (cannot be deleted)
CREATE POLICY "specialists_delete_own_drafts"
ON vault_notes
FOR DELETE
TO authenticated
USING (
  specialist_id = auth.uid()::text
  AND (published IS NULL OR published = false)
);
