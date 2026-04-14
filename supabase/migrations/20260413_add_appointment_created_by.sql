-- Add created_by column to appointments table
-- Tracks who created each appointment for permission logic
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS created_by UUID;
