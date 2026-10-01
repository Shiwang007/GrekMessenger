import { pool } from "../config/database.js";
import { requireMember } from "./authorization.service.js";
import * as receiptRepository from "../repositories/receipt.repository.js";
import * as unreadRepository from "../repositories/unread.repository.js";

/**
 * Mark a message as delivered to a recipient.
 * Validates active conversation membership and ensures recipient != sender.
 */
export async function markDelivered({ messageId, userId }) {
  if (!messageId || !userId) {
    throw new Error("messageId and userId are required");
  }

  // Find message details
  const { rows: msgRows } = await pool.query(
    `
      SELECT
        m.id,
        m.conversation_id,
        m.sender_id,
        c.type AS conversation_type
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = $1
      LIMIT 1
    `,
    [messageId]
  );

  const message = msgRows[0];
  if (!message) {
    const err = new Error("Message not found");
    err.code = "MESSAGE_NOT_FOUND";
    throw err;
  }

  // Sender does not generate delivery receipt for their own message
  if (message.sender_id === userId) {
    return null;
  }

  // Verify recipient is an active member of this conversation
  await requireMember({
    conversationId: message.conversation_id,
    userId,
  });

  const receipt = await receiptRepository.upsertDeliveryReceipt(pool, {
    messageId,
    userId,
  });

  // Calculate summary if group
  let summary = { seenCount: 0, recipientCount: 0 };
  if (message.conversation_type === "GROUP") {
    summary = await receiptRepository.getReceiptSummary(pool, {
      messageId,
      conversationId: message.conversation_id,
      senderId: message.sender_id,
    });
  }

  return {
    conversationId: message.conversation_id,
    messageId,
    userId,
    deliveredAt: receipt.delivered_at,
    readAt: receipt.read_at,
    seenCount: summary.seenCount,
    recipientCount: summary.recipientCount,
  };
}

/**
 * Transactionally advances the user's read position up to target message.
 * Enforces strict monotonic progression (newer target only).
 */
export async function markConversationRead({ conversationId, messageId, userId }) {
  if (!conversationId || !messageId || !userId) {
    throw new Error("conversationId, messageId, and userId are required");
  }

  // Verify membership, target message existence, and monotonic order in one authoritative SQL query
  const { rows: checkRows } = await pool.query(
    `
      SELECT
        target.id AS target_id,
        target.conversation_id,
        target.sender_id,
        c.type AS conversation_type,
        cm.last_read_message_id,
        CASE
          WHEN cm.last_read_message_id IS NULL THEN TRUE
          WHEN target.created_at > lr.created_at THEN TRUE
          WHEN target.created_at = lr.created_at AND target.id > lr.id THEN TRUE
          ELSE FALSE
        END AS is_newer
      FROM conversation_members cm
      JOIN conversations c ON c.id = cm.conversation_id
      JOIN messages target ON target.id = $2 AND target.conversation_id = $1
      LEFT JOIN messages lr ON lr.id = cm.last_read_message_id
      WHERE cm.conversation_id = $1
        AND cm.user_id = $3
        AND cm.removed_at IS NULL
      LIMIT 1
    `,
    [conversationId, messageId, userId]
  );

  const target = checkRows[0];
  if (!target) {
    // Check if membership was denied or target message invalid
    await requireMember({ conversationId, userId });
    const err = new Error("Target message does not belong to conversation");
    err.code = "INVALID_TARGET_MESSAGE";
    throw err;
  }

  // If target position is older than or equal to current read position, do not regress
  if (!target.is_newer) {
    const unreadCount = await unreadRepository.getUnreadCount(pool, {
      conversationId,
      userId,
    });

    return {
      monotonicIgnored: true,
      conversationId,
      messageId: target.last_read_message_id,
      userId,
      unreadCount,
      readReceipts: [],
    };
  }

  // Execute read updates inside transaction
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Advance conversation_members.last_read_message_id
    await unreadRepository.updateLastReadMessageId(client, {
      conversationId,
      userId,
      messageId: target.target_id,
    });

    // 2. Advance individual message receipts up to target
    const updatedReceipts = await receiptRepository.markMessagesReadUpTo(client, {
      conversationId,
      userId,
      targetMessageId: target.target_id,
    });

    // 3. Compute remaining unread count
    const unreadCount = await unreadRepository.getUnreadCount(client, {
      conversationId,
      userId,
    });

    await client.query("COMMIT");

    // Get group summary for target message
    let summary = { seenCount: 0, recipientCount: 0 };
    if (target.conversation_type === "GROUP") {
      summary = await receiptRepository.getReceiptSummary(pool, {
        messageId: target.id,
        conversationId,
        senderId: target.sender_id,
      });
    }

    return {
      monotonicIgnored: false,
      conversationId,
      messageId: target.id,
      userId,
      deliveredAt: new Date().toISOString(),
      readAt: new Date().toISOString(),
      seenCount: summary.seenCount,
      recipientCount: summary.recipientCount,
      unreadCount,
      updatedReceiptsCount: updatedReceipts.length,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
