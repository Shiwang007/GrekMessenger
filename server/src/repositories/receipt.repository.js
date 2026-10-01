import { pool } from "../config/database.js";

/**
 * Upsert delivery receipt for a specific message and recipient user.
 * Sets delivered_at to NOW() if not already set.
 * Idempotent: repeated calls will not alter the initial delivered_at.
 */
export async function upsertDeliveryReceipt(clientOrPool, { messageId, userId }) {
  const db = clientOrPool || pool;
  const result = await db.query(
    `
      INSERT INTO message_receipts (
        message_id,
        user_id,
        delivered_at
      )
      VALUES ($1, $2, NOW())
      ON CONFLICT (message_id, user_id)
      DO UPDATE SET
        delivered_at = COALESCE(message_receipts.delivered_at, EXCLUDED.delivered_at)
      RETURNING
        message_id,
        user_id,
        delivered_at,
        read_at
    `,
    [messageId, userId]
  );

  return result.rows[0];
}

/**
 * Mark all incoming messages in a conversation up to a target message as delivered and read.
 * Idempotent: uses ON CONFLICT DO UPDATE to preserve earliest timestamps.
 */
export async function markMessagesReadUpTo(
  clientOrPool,
  { conversationId, userId, targetMessageId }
) {
  const db = clientOrPool || pool;
  const result = await db.query(
    `
      INSERT INTO message_receipts (
        message_id,
        user_id,
        delivered_at,
        read_at
      )
      SELECT
        m.id,
        $1,
        NOW(),
        NOW()
      FROM messages m
      JOIN messages target_msg ON target_msg.id = $3
      WHERE m.conversation_id = $2
        AND m.sender_id <> $1
        AND m.deleted_at IS NULL
        AND (
          m.created_at < target_msg.created_at
          OR (
            m.created_at = target_msg.created_at
            AND m.id <= target_msg.id
          )
        )
      ON CONFLICT (message_id, user_id)
      DO UPDATE SET
        delivered_at = COALESCE(message_receipts.delivered_at, EXCLUDED.delivered_at),
        read_at = COALESCE(message_receipts.read_at, EXCLUDED.read_at)
      RETURNING
        message_id,
        user_id,
        delivered_at,
        read_at
    `,
    [userId, conversationId, targetMessageId]
  );

  return result.rows;
}

/**
 * Get aggregate seen and recipient counts for a message (used for group "Seen by X of Y").
 */
export async function getReceiptSummary(clientOrPool, { messageId, conversationId, senderId }) {
  const db = clientOrPool || pool;
  const result = await db.query(
    `
      SELECT
        COUNT(mr.read_at)::int AS seen_count,
        (
          SELECT (COUNT(*) - 1)::int
          FROM conversation_members cm
          WHERE cm.conversation_id = $2
            AND cm.removed_at IS NULL
        ) AS recipient_count
      FROM message_receipts mr
      JOIN conversation_members cm
        ON cm.user_id = mr.user_id
       AND cm.conversation_id = $2
       AND cm.removed_at IS NULL
      WHERE mr.message_id = $1
        AND mr.read_at IS NOT NULL
        AND mr.user_id <> $3
    `,
    [messageId, conversationId, senderId]
  );

  const row = result.rows[0];
  return {
    seenCount: row?.seen_count || 0,
    recipientCount: Math.max(0, row?.recipient_count || 0),
  };
}

/**
 * Get receipt status for a 1:1 message (the recipient's delivery/read timestamp).
 */
export async function getDirectMessageReceipt(clientOrPool, { messageId, senderId }) {
  const db = clientOrPool || pool;
  const result = await db.query(
    `
      SELECT
        delivered_at,
        read_at
      FROM message_receipts
      WHERE message_id = $1
        AND user_id <> $2
      LIMIT 1
    `,
    [messageId, senderId]
  );

  return result.rows[0] ?? null;
}
