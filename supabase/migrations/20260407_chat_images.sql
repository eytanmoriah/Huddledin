-- Add image support to chat messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_path TEXT;
