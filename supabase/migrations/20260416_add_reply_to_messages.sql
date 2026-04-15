-- Chat reply threading: link a message to the one it's replying to.
-- Soft link (ON DELETE SET NULL) so deleting the original doesn't cascade-delete replies.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS messages_reply_to_idx ON messages(reply_to_id);
