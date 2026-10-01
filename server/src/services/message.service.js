import { pool } from "../config/database.js";
import * as messageRepository from "../repositories/message.repository.js";
import * as reactionRepository from "../repositories/reaction.repository.js";
import { requireMember } from "./authorization.service.js";
import { decodeMessageCursor, encodeCursor } from "../utils/cursor.js";

const MAX_MESSAGE_LENGTH = 5000;

function validateMessage({ clientMessageId, content }) {
  if (
    typeof clientMessageId !== "string" ||
    !clientMessageId.trim()
  ) {
    const error = new Error("Invalid client message ID.");
    error.statusCode = 400;
    error.code = "INVALID_CLIENT_MESSAGE_ID";
    throw error;
  }

  if (
    typeof content !== "string" ||
    !content.trim()
  ) {
    const error = new Error("Message content cannot be empty.");
    error.statusCode = 400;
    error.code = "INVALID_MESSAGE";
    throw error;
  }

  if (content.length > MAX_MESSAGE_LENGTH) {
    const error = new Error("Message exceeds maximum permitted length.");
    error.statusCode = 400;
    error.code = "MESSAGE_TOO_LONG";
    throw error;
  }
}

export function toMessageResponse(message, reactions) {
  if (!message) return null;

  const deletedAt = message.deleted_at !== undefined ? message.deleted_at : (message.deletedAt || null);
  const isDeleted = !!deletedAt;

  return {
    id: message.id,
    conversationId: message.conversation_id || message.conversationId,
    senderId: message.sender_id || message.senderId,
    clientMessageId: message.client_message_id || message.clientMessageId,
    content: isDeleted ? null : message.content,
    createdAt: message.created_at || message.createdAt,
    updatedAt: message.updated_at !== undefined ? message.updated_at : (message.updatedAt || null),
    deletedAt,
    deliveredAt: message.delivered_at ? new Date(message.delivered_at).toISOString() : (message.deliveredAt || null),
    readAt: message.read_at ? new Date(message.read_at).toISOString() : (message.readAt || null),
    seenCount: Number(message.seen_count ?? message.seenCount ?? 0),
    recipientCount: Number(message.recipient_count ?? message.recipientCount ?? 0),
    reactions: isDeleted ? [] : (reactions ?? message.reactions ?? []),
    sender: message.sender || (message.sender_name
      ? {
          id: message.sender_id || message.senderId,
          name: message.sender_name,
          avatarUrl: message.sender_avatar_url,
        }
      : undefined),
  };
}

function validateContent(content) {
  if (typeof content !== "string" || !content.trim()) {
    const error = new Error("Message content cannot be empty.");
    error.statusCode = 400;
    error.code = "INVALID_CONTENT";
    throw error;
  }

  if (content.length > MAX_MESSAGE_LENGTH) {
    const error = new Error("Message exceeds maximum permitted length.");
    error.statusCode = 400;
    error.code = "MESSAGE_TOO_LONG";
    throw error;
  }
}

export async function createMessage({
  conversationId,
  senderId,
  clientMessageId,
  content,
}) {
  validateMessage({ clientMessageId, content });

  // Authorization: user must be an active member of this conversation
  const member = await requireMember({
    conversationId,
    userId: senderId,
  });

  const normalizedContent = content.trim();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Fast-path idempotency check
    const existing = await messageRepository.findByClientMessageId(
      client,
      {
        senderId,
        clientMessageId,
      }
    );

    if (existing) {
      await client.query("COMMIT");
      if (!existing.sender_name && member) {
        existing.sender_name = member.name;
        existing.sender_avatar_url = member.avatar_url;
      }
      const formatted = toMessageResponse(existing);
      return {
        ...existing,
        ...formatted,
        raw: existing,
        message: formatted,
        duplicate: true,
      };
    }

    let message;
    let isDuplicate = false;

    // Use a SAVEPOINT to cleanly recover from 23505 race conditions
    await client.query("SAVEPOINT msg_insert");
    try {
      message = await messageRepository.createMessage(
        client,
        {
          conversationId,
          senderId,
          clientMessageId,
          content: normalizedContent,
        }
      );
      await client.query("RELEASE SAVEPOINT msg_insert");
    } catch (error) {
      if (error.code !== "23505") {
        throw error;
      }
      await client.query("ROLLBACK TO SAVEPOINT msg_insert");
      message = await messageRepository.findByClientMessageId(
        client,
        {
          senderId,
          clientMessageId,
        }
      );
      isDuplicate = true;
    }

    // Touch conversation updated_at for genuinely new messages only
    if (!isDuplicate) {
      await messageRepository.touchConversation(
        client,
        conversationId
      );
    }

    await client.query("COMMIT");

    // Attach sender info if missing from raw RETURNING
    if (!message.sender_name && member) {
      message.sender_name = member.name;
      message.sender_avatar_url = member.avatar_url;
    }

    const formatted = toMessageResponse(message);
    return {
      ...message,
      ...formatted,
      raw: message,
      message: formatted,
      duplicate: isDuplicate,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listMessages({
  conversationId,
  userId,
  limit = 50,
  before = null,
}) {
  // Authorization: user must be an active member
  await requireMember({
    conversationId,
    userId,
  });

  const parsed = Number(limit) || 50;
  const safeLimit = Math.min(Math.max(parsed, 1), 100);

  const cursor = before ? decodeMessageCursor(before) : null;

  const rows = cursor
    ? await messageRepository.listMessagesBefore(
        conversationId,
        cursor,
        safeLimit + 1
      )
    : await messageRepository.listLatestMessages(
        conversationId,
        safeLimit + 1
      );

  const hasMore = rows.length > safeLimit;
  const page = rows.slice(0, safeLimit);

  // Generate cursor based on oldest record in this page BEFORE reversing
  const nextCursor =
    hasMore && page.length
      ? encodeCursor({
          createdAt: page[page.length - 1].created_at,
          id: page[page.length - 1].id,
        })
      : null;

  // Chronological order for client: oldest to newest
  page.reverse();

  // Batch-fetch reaction summaries to avoid N+1
  const messageIds = page.map((m) => m.id);
  const reactionsMap = await reactionRepository.getReactionSummaryBatch(null, messageIds);

  return {
    messages: page.map((msg) => toMessageResponse(msg, reactionsMap.get(msg.id) || [])),
    nextCursor,
  };
}

export async function editMessage({ userId, conversationId, messageId, content }) {
  await requireMember({ conversationId, userId });
  validateContent(content);

  const message = await messageRepository.findById(null, messageId);

  if (!message || message.conversation_id !== conversationId) {
    const error = new Error("Message not found.");
    error.statusCode = 404;
    error.code = "MESSAGE_NOT_FOUND";
    throw error;
  }

  if (message.sender_id !== userId) {
    const error = new Error("You can only edit your own messages.");
    error.statusCode = 403;
    error.code = "MESSAGE_NOT_OWNED";
    throw error;
  }

  if (message.deleted_at) {
    const error = new Error("Cannot edit a deleted message.");
    error.statusCode = 409;
    error.code = "MESSAGE_ALREADY_DELETED";
    throw error;
  }

  const age = Date.now() - new Date(message.created_at).getTime();
  if (age > 10 * 60 * 1000) {
    const error = new Error("Message can no longer be edited.");
    error.statusCode = 403;
    error.code = "MESSAGE_EDIT_WINDOW_EXPIRED";
    throw error;
  }

  const updated = await messageRepository.updateContent(null, {
    messageId,
    senderId: userId,
    content: content.trim(),
  });

  if (!updated) {
    const error = new Error("Message can no longer be edited.");
    error.statusCode = 403;
    error.code = "MESSAGE_EDIT_WINDOW_EXPIRED";
    throw error;
  }

  const reactions = await reactionRepository.getReactionSummary(null, messageId);
  return toMessageResponse(updated, reactions);
}

export async function deleteMessage({ userId, conversationId, messageId }) {
  await requireMember({ conversationId, userId });

  // Pre-flight check for specific error messages
  const message = await messageRepository.findById(null, messageId);

  if (!message || message.conversation_id !== conversationId) {
    const error = new Error("Message not found.");
    error.statusCode = 404;
    error.code = "MESSAGE_NOT_FOUND";
    throw error;
  }

  if (message.sender_id !== userId) {
    const error = new Error("You can only delete your own messages.");
    error.statusCode = 403;
    error.code = "MESSAGE_NOT_OWNED";
    throw error;
  }

  if (message.deleted_at) {
    const error = new Error("Message is already deleted.");
    error.statusCode = 409;
    error.code = "MESSAGE_ALREADY_DELETED";
    throw error;
  }

  const age = Date.now() - new Date(message.created_at).getTime();
  if (age > 10 * 60 * 1000) {
    const error = new Error("Message can no longer be deleted.");
    error.statusCode = 403;
    error.code = "MESSAGE_DELETE_WINDOW_EXPIRED";
    throw error;
  }

  // Atomic transactional delete (DB enforces the 10-min window as final guard)
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const deleted = await messageRepository.softDelete(client, {
      messageId,
      conversationId,
      senderId: userId,
    });

    if (!deleted) {
      await client.query("ROLLBACK");
      const error = new Error("Message can no longer be deleted.");
      error.statusCode = 403;
      error.code = "MESSAGE_DELETE_WINDOW_EXPIRED";
      throw error;
    }

    await reactionRepository.removeAllForMessage(client, messageId);

    await client.query("COMMIT");

    return {
      id: deleted.id,
      conversationId: deleted.conversation_id,
      senderId: deleted.sender_id,
      deletedAt: deleted.deleted_at,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function getReactionsForMessage(messageId) {
  return reactionRepository.getReactionSummary(null, messageId);
}
