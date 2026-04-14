-- Report Templates
CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sections JSONB NOT NULL DEFAULT '[]',
  writing_style JSONB,
  source TEXT DEFAULT 'manual',
  use_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "specialists_crud_own_templates" ON report_templates FOR ALL TO authenticated
  USING (specialist_id = auth.uid()) WITH CHECK (specialist_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_report_templates_specialist ON report_templates(specialist_id);
ALTER PUBLICATION supabase_realtime ADD TABLE report_templates;

-- Add template_id and sections_included to reports
ALTER TABLE reports ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES report_templates(id);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS sections_included JSONB;
