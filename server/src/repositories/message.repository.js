import { pool } from "../config/database.js";

export async function createMessage(
  client,
  { conversationId, senderId, clientMessageId, content }
) {
  const result = await client.query(
    `
      INSERT INTO messages (
        conversation_id,
        sender_id,
        client_message_id,
        content
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        conversation_id,
        sender_id,
        client_message_id,
        content,
        created_at,
        updated_at,
        deleted_at
    `,
    [conversationId, senderId, clientMessageId, content]
  );

  return result.rows[0];
}

export async function findByClientMessageId(
  clientOrPool,
  { senderId, clientMessageId }
) {
  const executor = clientOrPool || pool;
  const result = await executor.query(
    `
      SELECT
        m.id,
        m.conversation_id,
        m.sender_id,
        m.client_message_id,
        m.content,
        m.created_at,
        m.updated_at,
        m.deleted_at,
        u.name AS sender_name,
        u.avatar_url AS sender_avatar_url
      FROM messages m
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.sender_id = $1
        AND m.client_message_id = $2
      LIMIT 1
    `,
    [senderId, clientMessageId]
  );

  return result.rows[0] ?? null;
}

export async function touchConversation(client, conversationId) {
  await client.query(
    `
      UPDATE conversations
      SET updated_at = NOW()
      WHERE id = $1
    `,
    [conversationId]
  );
}

export async function listLatestMessages(conversationId, limit, clientOrPool = null) {
  const executor = clientOrPool || pool;
  const result = await executor.query(
    `
      SELECT
        m.id,
        m.conversation_id,
        m.sender_id,
        m.client_message_id,
        m.content,
        m.created_at,
        m.updated_at,
        m.deleted_at,
        u.name AS sender_name,
        u.avatar_url AS sender_avatar_url,
        receipt.delivered_at,
        receipt.read_at,
        COALESCE(group_receipts.seen_count, 0)::int AS seen_count,
        COALESCE(group_members.recipient_count, 0)::int AS recipient_count
      FROM messages m
      LEFT JOIN users u ON u.id = m.sender_id
      LEFT JOIN LATERAL (
        SELECT mr.delivered_at, mr.read_at
        FROM message_receipts mr
        WHERE mr.message_id = m.id
          AND mr.user_id <> m.sender_id
        LIMIT 1
      ) receipt ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(mr.read_at)::int AS seen_count
        FROM message_receipts mr
        JOIN conversation_members cm
          ON cm.user_id = mr.user_id
         AND cm.conversation_id = m.conversation_id
         AND cm.removed_at IS NULL
        WHERE mr.message_id = m.id
          AND mr.read_at IS NOT NULL
          AND mr.user_id <> m.sender_id
      ) group_receipts ON TRUE
      LEFT JOIN LATERAL (
        SELECT (COUNT(*) - 1)::int AS recipient_count
        FROM conversation_members cm
        WHERE cm.conversation_id = m.conversation_id
          AND cm.removed_at IS NULL
      ) group_members ON TRUE
      WHERE m.conversation_id = $1
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT $2
    `,
    [conversationId, limit]
  );

  return result.rows;
}

export async function listMessagesBefore(
  conversationId,
  cursor,
  limit,
  clientOrPool = null
) {
  const executor = clientOrPool || pool;
  const result = await executor.query(
    `
      SELECT
        m.id,
        m.conversation_id,
        m.sender_id,
        m.client_message_id,
        m.content,
        m.created_at,
        m.updated_at,
        m.deleted_at,
        u.name AS sender_name,
        u.avatar_url AS sender_avatar_url,
        receipt.delivered_at,
        receipt.read_at,
        COALESCE(group_receipts.seen_count, 0)::int AS seen_count,
        COALESCE(group_members.recipient_count, 0)::int AS recipient_count
      FROM messages m
      LEFT JOIN users u ON u.id = m.sender_id
      LEFT JOIN LATERAL (
        SELECT mr.delivered_at, mr.read_at
        FROM message_receipts mr
        WHERE mr.message_id = m.id
          AND mr.user_id <> m.sender_id
        LIMIT 1
      ) receipt ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(mr.read_at)::int AS seen_count
        FROM message_receipts mr
        JOIN conversation_members cm
          ON cm.user_id = mr.user_id
         AND cm.conversation_id = m.conversation_id
         AND cm.removed_at IS NULL
        WHERE mr.message_id = m.id
          AND mr.read_at IS NOT NULL
          AND mr.user_id <> m.sender_id
      ) group_receipts ON TRUE
      LEFT JOIN LATERAL (
        SELECT (COUNT(*) - 1)::int AS recipient_count
        FROM conversation_members cm
        WHERE cm.conversation_id = m.conversation_id
          AND cm.removed_at IS NULL
      ) group_members ON TRUE
      WHERE m.conversation_id = $1
        AND (
          m.created_at < $2
          OR (
            m.created_at = $2
            AND m.id < $3
          )
        )
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT $4
    `,
    [conversationId, cursor.createdAt, cursor.id, limit]
  );

  return result.rows;
}

export async function findById(clientOrPool, messageId) {
  const executor = clientOrPool || pool;
  const result = await executor.query(
    `
      SELECT
        id, conversation_id, sender_id, client_message_id,
        content, created_at, updated_at, deleted_at
      FROM messages
      WHERE id = $1
    `,
    [messageId]
  );

  return result.rows[0] ?? null;
}

export async function updateContent(clientOrPool, { messageId, senderId, content }) {
  const executor = clientOrPool || pool;
  const result = await executor.query(
    `
      UPDATE messages
      SET content = $1, updated_at = NOW()
      WHERE id = $2
        AND sender_id = $3
        AND deleted_at IS NULL
        AND created_at >= NOW() - INTERVAL '10 minutes'
      RETURNING
        id, conversation_id, sender_id, client_message_id,
        content, created_at, updated_at, deleted_at
    `,
    [content, messageId, senderId]
  );

  return result.rows[0] ?? null;
}

export async function softDelete(client, { messageId, conversationId, senderId }) {
  const result = await client.query(
    `
      UPDATE messages
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1
        AND conversation_id = $2
        AND sender_id = $3
        AND deleted_at IS NULL
        AND created_at >= NOW() - INTERVAL '10 minutes'
      RETURNING
        id, conversation_id, sender_id,
        created_at, updated_at, deleted_at
    `,
    [messageId, conversationId, senderId]
  );

  return result.rows[0] ?? null;
}

