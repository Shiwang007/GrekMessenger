import { pool } from "../config/database.js";

export async function addReaction(clientOrPool, { messageId, userId, emoji }) {
  const executor = clientOrPool || pool;
  const result = await executor.query(
    `
      INSERT INTO message_reactions (message_id, user_id, emoji)
      VALUES ($1, $2, $3)
      ON CONFLICT (message_id, user_id, emoji) DO NOTHING
      RETURNING message_id, user_id, emoji, created_at
    `,
    [messageId, userId, emoji]
  );

  return result.rows[0] ?? null;
}

export async function removeReaction(clientOrPool, { messageId, userId, emoji }) {
  const executor = clientOrPool || pool;
  const result = await executor.query(
    `
      DELETE FROM message_reactions
      WHERE message_id = $1
        AND user_id = $2
        AND emoji = $3
      RETURNING message_id, user_id, emoji
    `,
    [messageId, userId, emoji]
  );

  return result.rows[0] ?? null;
}

export async function removeAllForMessage(client, messageId) {
  await client.query(
    `DELETE FROM message_reactions WHERE message_id = $1`,
    [messageId]
  );
}

export async function getReactionSummary(clientOrPool, messageId) {
  const executor = clientOrPool || pool;
  const result = await executor.query(
    `
      SELECT
        emoji,
        COUNT(*)::int AS count,
        ARRAY_AGG(user_id) AS user_ids
      FROM message_reactions
      WHERE message_id = $1
      GROUP BY emoji
      ORDER BY emoji
    `,
    [messageId]
  );

  return result.rows.map((r) => ({
    emoji: r.emoji,
    count: r.count,
    userIds: r.user_ids,
  }));
}

export async function getReactionSummaryBatch(clientOrPool, messageIds) {
  if (!messageIds.length) return new Map();

  const executor = clientOrPool || pool;
  const result = await executor.query(
    `
      SELECT
        message_id,
        emoji,
        COUNT(*)::int AS count,
        ARRAY_AGG(user_id) AS user_ids
      FROM message_reactions
      WHERE message_id = ANY($1)
      GROUP BY message_id, emoji
      ORDER BY message_id, emoji
    `,
    [messageIds]
  );

  const map = new Map();
  for (const row of result.rows) {
    if (!map.has(row.message_id)) {
      map.set(row.message_id, []);
    }
    map.get(row.message_id).push({
      emoji: row.emoji,
      count: row.count,
      userIds: row.user_ids,
    });
  }

  return map;
}
