-- Add count tracking to notifications for stacking
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS meta_count INTEGER DEFAULT 1;
