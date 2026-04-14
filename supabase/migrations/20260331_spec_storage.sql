-- Specialist Personal Storage — tables, RLS, indexes, storage bucket

-- Folders
CREATE TABLE IF NOT EXISTS spec_vault_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_folder_id UUID REFERENCES spec_vault_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE spec_vault_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "specialists_crud_own_folders"
ON spec_vault_folders FOR ALL
TO authenticated
USING (specialist_id = auth.uid())
WITH CHECK (specialist_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_spec_folders_specialist ON spec_vault_folders(specialist_id);
CREATE INDEX IF NOT EXISTS idx_spec_folders_parent ON spec_vault_folders(parent_folder_id);

-- Files
CREATE TABLE IF NOT EXISTS spec_vault_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES spec_vault_folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  file_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE spec_vault_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "specialists_crud_own_files"
ON spec_vault_files FOR ALL
TO authenticated
USING (specialist_id = auth.uid())
WITH CHECK (specialist_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_spec_files_specialist ON spec_vault_files(specialist_id);
CREATE INDEX IF NOT EXISTS idx_spec_files_folder ON spec_vault_files(folder_id);

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('specialist-storage', 'specialist-storage', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: specialists own their path
CREATE POLICY "specialists_own_storage"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'specialist-storage' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'specialist-storage' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE spec_vault_folders;
ALTER PUBLICATION supabase_realtime ADD TABLE spec_vault_files;

-- Storage tier on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storage_tier TEXT DEFAULT 'base';
