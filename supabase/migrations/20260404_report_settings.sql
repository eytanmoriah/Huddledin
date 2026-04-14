CREATE TABLE IF NOT EXISTS report_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_name TEXT,
  practice_address TEXT,
  practice_phone TEXT,
  practice_email TEXT,
  logo_storage_path TEXT,
  header_color TEXT DEFAULT '#0d9488',
  font_style TEXT DEFAULT 'sans-serif',
  header_style TEXT DEFAULT 'compact',
  footer_text TEXT DEFAULT 'Confidential — For Clinical Use Only',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE report_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "specialists_crud_own_settings" ON report_settings FOR ALL TO authenticated
  USING (specialist_id = auth.uid()) WITH CHECK (specialist_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_report_settings_specialist ON report_settings(specialist_id);
