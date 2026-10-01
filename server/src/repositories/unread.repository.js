import { pool } from "../config/database.js";

/**
 * Derives authoritative unread count for a user in a conversation.
 * Excludes messages sent by the user and soft-deleted messages.
 */
export async function getUnreadCount(clientOrPool, { conversationId, userId }) {
  const db = clientOrPool || pool;
  const result = await db.query(
    `
      SELECT COUNT(*)::int AS unread_count
      FROM messages m
      JOIN conversation_members cm
        ON cm.conversation_id = m.conversation_id
       AND cm.user_id = $2
       AND cm.removed_at IS NULL
      LEFT JOIN messages lr
        ON lr.id = cm.last_read_message_id
      WHERE m.conversation_id = $1
        AND m.sender_id <> $2
        AND m.deleted_at IS NULL
        AND (
          cm.last_read_message_id IS NULL
          OR m.created_at > lr.created_at
          OR (
            m.created_at = lr.created_at
            AND m.id > lr.id
          )
        )
    `,
    [conversationId, userId]
  );

  return result.rows[0]?.unread_count ?? 0;
}

/**
 * Get member's current read cursor info (last_read_message_id, created_at, id).
 */
export async function getMemberReadCursor(clientOrPool, { conversationId, userId }) {
  const db = clientOrPool || pool;
  const result = await db.query(
    `
      SELECT
        cm.last_read_message_id,
        lr.created_at AS last_read_created_at,
        lr.id AS last_read_id
      FROM conversation_members cm
      LEFT JOIN messages lr
        ON lr.id = cm.last_read_message_id
      WHERE cm.conversation_id = $1
        AND cm.user_id = $2
        AND cm.removed_at IS NULL
      LIMIT 1
    `,
    [conversationId, userId]
  );

  return result.rows[0] ?? null;
}

/**
 * Update conversation_members.last_read_message_id.
 */
export async function updateLastReadMessageId(
  clientOrPool,
  { conversationId, userId, messageId }
) {
  const db = clientOrPool || pool;
  const result = await db.query(
    `
      UPDATE conversation_members
      SET last_read_message_id = $3
      WHERE conversation_id = $1
        AND user_id = $2
        AND removed_at IS NULL
      RETURNING
        conversation_id,
        user_id,
        last_read_message_id
    `,
    [conversationId, userId, messageId]
  );

  return result.rows[0] ?? null;
}
