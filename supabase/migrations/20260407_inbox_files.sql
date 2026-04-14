-- Allow files to exist without a child (inbox/unsorted files)
ALTER TABLE files ALTER COLUMN child_id DROP NOT NULL;

-- RLS: parents can manage their own inbox files (child_id IS NULL)
CREATE POLICY "users_manage_own_inbox_files"
ON files FOR ALL TO authenticated
USING (child_id IS NULL AND uploaded_by = auth.uid())
WITH CHECK (child_id IS NULL AND uploaded_by = auth.uid());
