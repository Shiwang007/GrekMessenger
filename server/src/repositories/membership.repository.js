import { pool } from "../config/database.js";
import { ROLES } from "../constants/roles.js";

export async function findActiveMembership({ conversationId, userId }, clientOrPool = null) {
  const db = clientOrPool || pool;
  const result = await db.query(
    `
      SELECT
        cm.conversation_id,
        cm.user_id,
        cm.role,
        cm.joined_at,
        u.name,
        u.avatar_url
      FROM conversation_members cm
      INNER JOIN users u ON u.id = cm.user_id
      WHERE cm.conversation_id = $1
        AND cm.user_id = $2
        AND cm.removed_at IS NULL
      LIMIT 1
    `,
    [conversationId, userId]
  );

  return result.rows[0] ?? null;
}

export async function findMembership({ conversationId, userId }, clientOrPool = null) {
  const db = clientOrPool || pool;
  const result = await db.query(
    `
      SELECT
        conversation_id,
        user_id,
        role,
        joined_at,
        removed_at
      FROM conversation_members
      WHERE conversation_id = $1
        AND user_id = $2
      LIMIT 1
    `,
    [conversationId, userId]
  );

  return result.rows[0] ?? null;
}

export async function addMember(clientOrPool, { conversationId, userId, role = ROLES.MEMBER }) {
  const db = clientOrPool || pool;

  // Check if member already exists (active or removed)
  const existing = await findMembership({ conversationId, userId }, db);

  if (existing) {
    if (!existing.removed_at) {
      const error = new Error("User is already an active member of this conversation.");
      error.statusCode = 409;
      error.code = "ALREADY_MEMBER";
      throw error;
    }

    // Reactivate previously removed member
    const reactivated = await db.query(
      `
        UPDATE conversation_members
        SET
          removed_at = NULL,
          role = $3,
          joined_at = NOW()
        WHERE conversation_id = $1
          AND user_id = $2
        RETURNING
          conversation_id,
          user_id,
          role,
          joined_at
      `,
      [conversationId, userId, role]
    );

    return reactivated.rows[0];
  }

  // Insert fresh membership
  const inserted = await db.query(
    `
      INSERT INTO conversation_members (
        conversation_id,
        user_id,
        role,
        joined_at
      )
      VALUES (
        $1,
        $2,
        $3,
        NOW()
      )
      RETURNING
        conversation_id,
        user_id,
        role,
        joined_at
    `,
    [conversationId, userId, role]
  );

  return inserted.rows[0];
}

export async function removeMember(clientOrPool, { conversationId, userId }) {
  const db = clientOrPool || pool;
  const result = await db.query(
    `
      UPDATE conversation_members
      SET removed_at = NOW()
      WHERE conversation_id = $1
        AND user_id = $2
        AND removed_at IS NULL
      RETURNING
        conversation_id,
        user_id,
        role,
        removed_at
    `,
    [conversationId, userId]
  );

  return result.rows[0] ?? null;
}

export async function updateMemberRole(clientOrPool, { conversationId, userId, role }) {
  const db = clientOrPool || pool;
  const result = await db.query(
    `
      UPDATE conversation_members
      SET role = $3
      WHERE conversation_id = $1
        AND user_id = $2
        AND removed_at IS NULL
      RETURNING
        conversation_id,
        user_id,
        role
    `,
    [conversationId, userId, role]
  );

  return result.rows[0] ?? null;
}

export async function transferOwnership(client, { conversationId, currentOwnerId, newOwnerId }) {
  // Demote current owner to ADMIN
  const demoteResult = await client.query(
    `
      UPDATE conversation_members
      SET role = 'ADMIN'
      WHERE conversation_id = $1
        AND user_id = $2
        AND role = 'OWNER'
        AND removed_at IS NULL
      RETURNING user_id, role
    `,
    [conversationId, currentOwnerId]
  );

  if (demoteResult.rowCount === 0) {
    const error = new Error("Current user is not the owner.");
    error.statusCode = 403;
    error.code = "FORBIDDEN";
    throw error;
  }

  // Promote target user to OWNER
  const promoteResult = await client.query(
    `
      UPDATE conversation_members
      SET role = 'OWNER'
      WHERE conversation_id = $1
        AND user_id = $2
        AND removed_at IS NULL
      RETURNING user_id, role
    `,
    [conversationId, newOwnerId]
  );

  if (promoteResult.rowCount === 0) {
    const error = new Error("Target user is not an active member of this conversation.");
    error.statusCode = 404;
    error.code = "MEMBER_NOT_FOUND";
    throw error;
  }

  return {
    previousOwner: demoteResult.rows[0],
    newOwner: promoteResult.rows[0],
  };
}

export async function getConversationMembers(clientOrPool, conversationId) {
  const db = clientOrPool || pool;
  const result = await db.query(
    `
      SELECT
        u.id,
        u.name,
        u.email,
        u.avatar_url,
        u.last_seen_at,
        cm.role,
        cm.joined_at
      FROM conversation_members cm
      INNER JOIN users u
        ON u.id = cm.user_id
      WHERE cm.conversation_id = $1
        AND cm.removed_at IS NULL
      ORDER BY
        CASE cm.role
          WHEN 'OWNER' THEN 1
          WHEN 'ADMIN' THEN 2
          ELSE 3
        END,
        u.name ASC
    `,
    [conversationId]
  );

  return result.rows;
}
