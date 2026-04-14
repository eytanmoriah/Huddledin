-- Reports table
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES auth.users(id),
  child_id UUID NOT NULL REFERENCES children(id),
  appointment_id UUID REFERENCES appointments(id),
  report_type TEXT NOT NULL,
  specialty_template TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  form_data JSONB,
  generated_text TEXT,
  shared_with_parents BOOLEAN DEFAULT FALSE,
  shared_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "specialists_crud_own_reports"
ON reports FOR ALL
TO authenticated
USING (specialist_id = auth.uid())
WITH CHECK (specialist_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_reports_specialist ON reports(specialist_id);
CREATE INDEX IF NOT EXISTS idx_reports_child ON reports(child_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

ALTER PUBLICATION supabase_realtime ADD TABLE reports;

-- Credentials columns on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credentials_title TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credentials_license TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credentials_certs TEXT;
