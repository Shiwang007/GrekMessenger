-- database/seed/seed.sql

-- Clear existing data
TRUNCATE TABLE message_receipts, message_reactions, messages, conversation_members, conversations, refresh_tokens, users CASCADE;

-- 1. Insert 6 Users (Password for all: Password123!)
INSERT INTO users (id, email, password_hash, name, avatar_url, created_at, updated_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', '$2b$10$qeMJPvAeBhCU7eTSnf6G4eK0NWvYBsC7e7k/NhjlE1PS1NN/NLW/6', 'Alice Johnson', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice', NOW() - INTERVAL '10 days', NOW()),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com', '$2b$10$qeMJPvAeBhCU7eTSnf6G4eK0NWvYBsC7e7k/NhjlE1PS1NN/NLW/6', 'Bob Smith', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob', NOW() - INTERVAL '10 days', NOW()),
  ('33333333-3333-3333-3333-333333333333', 'charlie@example.com', '$2b$10$qeMJPvAeBhCU7eTSnf6G4eK0NWvYBsC7e7k/NhjlE1PS1NN/NLW/6', 'Charlie Brown', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie', NOW() - INTERVAL '9 days', NOW()),
  ('44444444-4444-4444-4444-444444444444', 'diana@example.com', '$2b$10$qeMJPvAeBhCU7eTSnf6G4eK0NWvYBsC7e7k/NhjlE1PS1NN/NLW/6', 'Diana Prince', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Diana', NOW() - INTERVAL '8 days', NOW()),
  ('55555555-5555-5555-5555-555555555555', 'ethan@example.com', '$2b$10$qeMJPvAeBhCU7eTSnf6G4eK0NWvYBsC7e7k/NhjlE1PS1NN/NLW/6', 'Ethan Hunt', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ethan', NOW() - INTERVAL '7 days', NOW()),
  ('66666666-6666-6666-6666-666666666666', 'fiona@example.com', '$2b$10$qeMJPvAeBhCU7eTSnf6G4eK0NWvYBsC7e7k/NhjlE1PS1NN/NLW/6', 'Fiona Gallagher', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Fiona', NOW() - INTERVAL '6 days', NOW());

-- 2. Insert 2 Groups and 2 Direct Conversations
INSERT INTO conversations (id, type, name, avatar_url, direct_key, created_by, created_at, updated_at)
VALUES
  -- Group A: Project Alpha
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'GROUP', 'Project Alpha', 'https://api.dicebear.com/7.x/identicon/svg?seed=Alpha', NULL, '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '5 days', NOW()),
  -- Group B: Engineering Team
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'GROUP', 'Engineering Team', 'https://api.dicebear.com/7.x/identicon/svg?seed=Engineering', NULL, '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '4 days', NOW()),
  -- Direct Conversation: Alice (1111...) <-> Bob (2222...)
  ('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'DIRECT', NULL, NULL, '11111111-1111-1111-1111-111111111111:22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '3 days', NOW()),
  -- Direct Conversation: Bob (2222...) <-> Charlie (3333...)
  ('c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'DIRECT', NULL, NULL, '22222222-2222-2222-2222-222222222222:33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '2 days', NOW());

-- 3. Insert Conversation Memberships
INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES
  -- Group A: Alice (Owner), Bob (Admin), Charlie (Member), Diana (Member)
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'OWNER', NOW() - INTERVAL '5 days'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'ADMIN', NOW() - INTERVAL '5 days'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'MEMBER', NOW() - INTERVAL '4 days'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'MEMBER', NOW() - INTERVAL '4 days'),

  -- Group B: Charlie (Owner), Ethan (Admin), Fiona (Member)
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'OWNER', NOW() - INTERVAL '4 days'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'ADMIN', NOW() - INTERVAL '4 days'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '66666666-6666-6666-6666-666666666666', 'MEMBER', NOW() - INTERVAL '3 days'),

  -- Direct 1: Alice & Bob
  ('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', '11111111-1111-1111-1111-111111111111', 'MEMBER', NOW() - INTERVAL '3 days'),
  ('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', '22222222-2222-2222-2222-222222222222', 'MEMBER', NOW() - INTERVAL '3 days'),

  -- Direct 2: Bob & Charlie
  ('c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', '22222222-2222-2222-2222-222222222222', 'MEMBER', NOW() - INTERVAL '2 days'),
  ('c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', '33333333-3333-3333-3333-333333333333', 'MEMBER', NOW() - INTERVAL '2 days');

-- 4. Insert Messages
INSERT INTO messages (id, conversation_id, sender_id, client_message_id, content, created_at, updated_at)
VALUES
  -- Messages in Group A
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'client-msg-101', 'Welcome everyone to Project Alpha! Let''s coordinate our sprint here.', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
  ('a1000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'client-msg-102', 'Thanks Alice! The backend architecture is ready for review.', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
  ('a1000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'client-msg-103', 'I''ll start working on the frontend components today.', NOW() - INTERVAL '12 hours', NOW() - INTERVAL '12 hours'),

  -- Messages in Group B
  ('a2000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'client-msg-201', 'Engineering standup in 10 minutes.', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
  ('a2000000-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'client-msg-202', 'Joining now!', NOW() - INTERVAL '23 hours', NOW() - INTERVAL '23 hours'),

  -- Messages in Direct 1 (Alice <-> Bob)
  ('a3000000-0000-0000-0000-000000000001', 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', '11111111-1111-1111-1111-111111111111', 'client-msg-301', 'Hey Bob, did you check the Supabase connection pooler?', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours'),
  ('a3000000-0000-0000-0000-000000000002', 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', '22222222-2222-2222-2222-222222222222', 'client-msg-302', 'Yes, tested and working properly!', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours');

-- 5. Insert Message Reactions
INSERT INTO message_reactions (message_id, user_id, emoji, created_at)
VALUES
  ('a1000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '👍', NOW() - INTERVAL '1 day 23 hours'),
  ('a1000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', '🚀', NOW() - INTERVAL '1 day 22 hours'),
  ('a1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '❤️', NOW() - INTERVAL '23 hours');

-- 6. Insert Message Receipts
INSERT INTO message_receipts (message_id, user_id, delivered_at, read_at)
VALUES
  ('a3000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '4 hours 59 minutes', NOW() - INTERVAL '4 hours 55 minutes'),
  ('a3000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '3 hours 59 minutes', NOW() - INTERVAL '3 hours 50 minutes');

-- 7. Update last_read_message_id on conversation_members
UPDATE conversation_members
SET last_read_message_id = 'a3000000-0000-0000-0000-000000000002'
WHERE conversation_id = 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1';
