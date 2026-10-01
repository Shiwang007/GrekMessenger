import { pool } from "../config/database.js";
import { isOnline } from "./presenceManager.js";
import { conversationRoom } from "../socket/rooms/roomNames.js";

/**
 * Persist last_seen_at timestamp to PostgreSQL when user transitions offline.
 */
export async function markLastSeen(userId) {
  const result = await pool.query(
    `
      UPDATE users
      SET last_seen_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING last_seen_at;
    `,
    [userId]
  );

  return result.rows[0]?.last_seen_at ?? new Date();
}

/**
 * Get stored last_seen_at for a given user.
 */
export async function getUserLastSeen(userId) {
  const result = await pool.query(
    `
      SELECT last_seen_at
      FROM users
      WHERE id = $1
      LIMIT 1;
    `,
    [userId]
  );

  return result.rows[0]?.last_seen_at ?? null;
}

/**
 * Calculate current presence state for a user.
 * Online state is derived from memory, lastSeenAt from PostgreSQL.
 */
export async function getPresence(userId) {
  const online = isOnline(userId);
  const lastSeenAt = online ? null : await getUserLastSeen(userId);

  return {
    userId,
    online,
    lastSeenAt: lastSeenAt ? new Date(lastSeenAt).toISOString() : null,
  };
}

/**
 * Broadcast presence:update event to all active conversation rooms containing userId.
 */
export async function broadcastPresence(io, userId, { online, lastSeenAt }) {
  if (!io) return;

  try {
    const { rows } = await pool.query(
      `
        SELECT conversation_id
        FROM conversation_members
        WHERE user_id = $1
          AND removed_at IS NULL;
      `,
      [userId]
    );

    const payload = {
      userId,
      online: Boolean(online),
      lastSeenAt: lastSeenAt ? new Date(lastSeenAt).toISOString() : null,
    };

    for (const row of rows) {
      io.to(conversationRoom(row.conversation_id)).emit("presence:update", payload);
    }
  } catch (error) {
    console.error(`Failed to broadcast presence update for user ${userId}:`, error);
  }
}
