-- database/migrations/008_create_indexes.sql

-- Index for conversation message history with cursor pagination (ORDER BY created_at DESC, id DESC)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
ON messages(conversation_id, created_at DESC, id DESC);

-- Index for listing conversations by user
CREATE INDEX IF NOT EXISTS idx_conversation_members_user
ON conversation_members(user_id);

-- Index for listing members by conversation
CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation
ON conversation_members(conversation_id);

-- Index for looking up active refresh tokens by user
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
ON refresh_tokens(user_id);

-- Index for looking up receipts by recipient user
CREATE INDEX IF NOT EXISTS idx_message_receipts_user
ON message_receipts(user_id);
