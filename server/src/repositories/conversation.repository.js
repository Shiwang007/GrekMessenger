import { pool } from "../config/database.js";

export async function findDirectConversation(client, directKey) {
  const result = await client.query(
    `
      SELECT
        id,
        type,
        name,
        avatar_url,
        direct_key,
        created_by,
        created_at,
        updated_at
      FROM conversations
      WHERE type = 'DIRECT'
        AND direct_key = $1
      LIMIT 1
    `,
    [directKey]
  );

  return result.rows[0] ?? null;
}

export async function createDirectConversation(client, { directKey, createdBy }) {
  const result = await client.query(
    `
      INSERT INTO conversations (
        type,
        direct_key,
        created_by
      )
      VALUES (
        'DIRECT',
        $1,
        $2
      )
      RETURNING
        id,
        type,
        name,
        avatar_url,
        direct_key,
        created_by,
        created_at,
        updated_at
    `,
    [directKey, createdBy]
  );

  return result.rows[0];
}

export async function createGroup(client, { name, avatarUrl = null, createdBy }) {
  const result = await client.query(
    `
      INSERT INTO conversations (
        type,
        name,
        avatar_url,
        created_by
      )
      VALUES (
        'GROUP',
        $1,
        $2,
        $3
      )
      RETURNING
        id,
        type,
        name,
        avatar_url,
        created_by,
        created_at,
        updated_at
    `,
    [name, avatarUrl, createdBy]
  );

  return result.rows[0];
}

export async function updateGroup(clientOrPool, conversationId, { name, avatarUrl }) {
  const db = clientOrPool || pool;
  const updates = [];
  const values = [conversationId];
  let paramIndex = 2;

  if (name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(name);
  }

  if (avatarUrl !== undefined) {
    updates.push(`avatar_url = $${paramIndex++}`);
    values.push(avatarUrl);
  }

  updates.push(`updated_at = NOW()`);

  const result = await db.query(
    `
      UPDATE conversations
      SET ${updates.join(", ")}
      WHERE id = $1 AND type = 'GROUP'
      RETURNING
        id,
        type,
        name,
        avatar_url,
        created_by,
        created_at,
        updated_at
    `,
    values
  );

  return result.rows[0] ?? null;
}

export async function deleteGroup(clientOrPool, conversationId) {
  const db = clientOrPool || pool;
  const result = await db.query(
    `
      DELETE FROM conversations
      WHERE id = $1 AND type = 'GROUP'
      RETURNING id
    `,
    [conversationId]
  );

  return result.rows[0] ?? null;
}

export async function findConversationById(clientOrPool, conversationId) {
  const db = clientOrPool || pool;
  const result = await db.query(
    `
      SELECT
        id,
        type,
        name,
        avatar_url,
        direct_key,
        created_by,
        created_at,
        updated_at
      FROM conversations
      WHERE id = $1
      LIMIT 1
    `,
    [conversationId]
  );

  return result.rows[0] ?? null;
}

export async function addConversationMember(client, { conversationId, userId, role = "MEMBER" }) {
  const result = await client.query(
    `
      INSERT INTO conversation_members (
        conversation_id,
        user_id,
        role
      )
      VALUES (
        $1,
        $2,
        $3
      )
      ON CONFLICT (conversation_id, user_id) DO NOTHING
      RETURNING
        conversation_id,
        user_id,
        role,
        joined_at
    `,
    [conversationId, userId, role]
  );

  return result.rows[0] ?? null;
}

export async function findConversationForMember(clientOrPool, conversationId, userId) {
  const db = clientOrPool || pool;
  const result = await db.query(
    `
      SELECT
        c.id,
        c.type,
        c.name,
        c.avatar_url,
        c.created_at,
        c.updated_at,
        current_member.role AS current_user_role,
        u.id AS other_user_id,
        u.name AS other_user_name,
        u.email AS other_user_email,
        u.avatar_url AS other_user_avatar_url,
        u.last_seen_at AS other_user_last_seen_at,
        current_member.last_read_message_id,
        (
          SELECT COUNT(*)::int
          FROM messages m
          LEFT JOIN messages lr ON lr.id = current_member.last_read_message_id
          WHERE m.conversation_id = c.id
            AND m.sender_id <> $2
            AND m.deleted_at IS NULL
            AND (
              current_member.last_read_message_id IS NULL
              OR m.created_at > lr.created_at
              OR (m.created_at = lr.created_at AND m.id > lr.id)
            )
        ) AS unread_count
      FROM conversations c
      INNER JOIN conversation_members current_member
        ON current_member.conversation_id = c.id
       AND current_member.user_id = $2
       AND current_member.removed_at IS NULL
      LEFT JOIN conversation_members other_member
        ON other_member.conversation_id = c.id
       AND other_member.user_id <> $2
       AND other_member.removed_at IS NULL
       AND c.type = 'DIRECT'
      LEFT JOIN users u
        ON u.id = other_member.user_id
      WHERE c.id = $1
      LIMIT 1
    `,
    [conversationId, userId]
  );

  return result.rows[0] ?? null;
}

export async function listConversationsForUser(clientOrPool, userId) {
  const db = clientOrPool || pool;
  const result = await db.query(
    `
      SELECT
        c.id,
        c.type,
        c.name,
        c.avatar_url,
        c.created_at,
        c.updated_at,
        current_member.role AS current_user_role,
        u.id AS other_user_id,
        u.name AS other_user_name,
        u.email AS other_user_email,
        u.avatar_url AS other_user_avatar_url,
        u.last_seen_at AS other_user_last_seen_at,
        current_member.last_read_message_id,
        (
          SELECT COUNT(*)::int
          FROM messages m
          LEFT JOIN messages lr ON lr.id = current_member.last_read_message_id
          WHERE m.conversation_id = c.id
            AND m.sender_id <> $1
            AND m.deleted_at IS NULL
            AND (
              current_member.last_read_message_id IS NULL
              OR m.created_at > lr.created_at
              OR (m.created_at = lr.created_at AND m.id > lr.id)
            )
        ) AS unread_count
      FROM conversations c
      INNER JOIN conversation_members current_member
        ON current_member.conversation_id = c.id
       AND current_member.user_id = $1
       AND current_member.removed_at IS NULL
      LEFT JOIN conversation_members other_member
        ON other_member.conversation_id = c.id
       AND other_member.user_id <> $1
       AND other_member.removed_at IS NULL
       AND c.type = 'DIRECT'
      LEFT JOIN users u
        ON u.id = other_member.user_id
      ORDER BY c.updated_at DESC, c.id DESC
    `,
    [userId]
  );

  return result.rows;
}
