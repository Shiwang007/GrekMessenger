import { pool } from "../config/database.js";
import { findUserById } from "../repositories/auth.repository.js";
import * as conversationRepository from "../repositories/conversation.repository.js";
import * as membershipRepository from "../repositories/membership.repository.js";
import { buildDirectKey } from "../utils/directKey.js";

import { isOnline } from "../presence/presenceManager.js";

function formatConversation(row, members = null) {
  const conversation = {
    id: row.id,
    type: row.type,
    name: row.name,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    currentUserRole: row.current_user_role,
    unreadCount: Number(row.unread_count ?? 0),
    lastReadMessageId: row.last_read_message_id ?? null,
    lastMessage: row.last_message_content
      ? {
          content: row.last_message_content,
          senderId: row.last_message_sender_id,
        }
      : null,
  };

  if (row.type === "DIRECT" && row.other_user_id) {
    const userIsOnline = isOnline(row.other_user_id);
    conversation.otherUser = {
      id: row.other_user_id,
      name: row.other_user_name,
      email: row.other_user_email,
      avatarUrl: row.other_user_avatar_url,
      online: userIsOnline,
      lastSeenAt: userIsOnline ? null : (row.other_user_last_seen_at ? new Date(row.other_user_last_seen_at).toISOString() : null),
    };
  }

  if (row.type === "GROUP" && members) {
    conversation.members = members.map((m) => {
      const memberIsOnline = isOnline(m.id);
      return {
        id: m.id,
        name: m.name,
        email: m.email,
        avatarUrl: m.avatar_url,
        role: m.role,
        joinedAt: m.joined_at,
        online: memberIsOnline,
        lastSeenAt: memberIsOnline ? null : (m.last_seen_at ? new Date(m.last_seen_at).toISOString() : null),
      };
    });
  }

  return conversation;
}

export async function getOrCreateDirectConversation({ currentUserId, targetUserId }) {
  if (!targetUserId) {
    const error = new Error("Target user ID is required");
    error.statusCode = 400;
    error.code = "INVALID_TARGET_USER";
    throw error;
  }

  if (currentUserId === targetUserId) {
    const error = new Error("You cannot create a conversation with yourself");
    error.statusCode = 400;
    error.code = "SELF_CONVERSATION_NOT_ALLOWED";
    throw error;
  }

  const targetUser = await findUserById(targetUserId);
  if (!targetUser) {
    const error = new Error("User not found");
    error.statusCode = 404;
    error.code = "USER_NOT_FOUND";
    throw error;
  }

  const directKey = buildDirectKey(currentUserId, targetUserId);

  const client = await pool.connect();
  let conversationId;

  try {
    await client.query("BEGIN");

    // Fast-path: check if conversation already exists
    const existing = await conversationRepository.findDirectConversation(client, directKey);

    if (existing) {
      conversationId = existing.id;
    } else {
      // Create with savepoint to guard against concurrent race insertion
      await client.query("SAVEPOINT insert_direct");
      try {
        const created = await conversationRepository.createDirectConversation(client, {
          directKey,
          createdBy: currentUserId,
        });

        await conversationRepository.addConversationMember(client, {
          conversationId: created.id,
          userId: currentUserId,
        });

        await conversationRepository.addConversationMember(client, {
          conversationId: created.id,
          userId: targetUserId,
        });

        await client.query("RELEASE SAVEPOINT insert_direct");
        conversationId = created.id;
      } catch (err) {
        if (err.code === "23505") { // unique_violation on direct_key
          await client.query("ROLLBACK TO SAVEPOINT insert_direct");
          const competing = await conversationRepository.findDirectConversation(client, directKey);
          if (!competing) {
            throw err;
          }
          conversationId = competing.id;
        } else {
          throw err;
        }
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // Retrieve complete member-context conversation details
  const conversationRow = await conversationRepository.findConversationForMember(
    null,
    conversationId,
    currentUserId
  );

  return formatConversation(conversationRow);
}

export async function getConversation({ conversationId, userId }) {
  const row = await conversationRepository.findConversationForMember(
    null,
    conversationId,
    userId
  );

  if (!row) {
    return null;
  }

  let members = null;
  if (row.type === "GROUP") {
    members = await membershipRepository.getConversationMembers(null, conversationId);
  }

  return formatConversation(row, members);
}

export async function listConversations(userId) {
  const rows = await conversationRepository.listConversationsForUser(null, userId);
  return rows.map((row) => formatConversation(row));
}
