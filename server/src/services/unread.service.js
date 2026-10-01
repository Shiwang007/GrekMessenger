import { pool } from "../config/database.js";
import * as unreadRepository from "../repositories/unread.repository.js";

/**
 * Get authoritative unread count for a user in a conversation.
 */
export async function getUnreadCount({ conversationId, userId }) {
  return unreadRepository.getUnreadCount(pool, { conversationId, userId });
}

/**
 * Get unread counts for all other active members in a conversation (after a new message is sent).
 * Returns array of { userId, unreadCount }.
 */
export async function getUnreadCountsForOtherMembers({ conversationId, senderId }) {
  const { rows: members } = await pool.query(
    `
      SELECT user_id
      FROM conversation_members
      WHERE conversation_id = $1
        AND user_id <> $2
        AND removed_at IS NULL
    `,
    [conversationId, senderId]
  );

  const results = [];
  for (const m of members) {
    const count = await unreadRepository.getUnreadCount(pool, {
      conversationId,
      userId: m.user_id,
    });
    results.push({ userId: m.user_id, unreadCount: count });
  }

  return results;
}
