-- database/migrations/003_create_conversations.sql

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('DIRECT', 'GROUP')),
    name TEXT,
    avatar_url TEXT,
    direct_key TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique index guaranteeing 1-to-1 direct conversation uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_direct_conversation
ON conversations(direct_key)
WHERE type = 'DIRECT';
