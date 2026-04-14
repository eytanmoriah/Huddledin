-- Add photo_url column to profiles table for specialist profile photos
-- Stores base64 data URI (same pattern as children.photo_url)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;
