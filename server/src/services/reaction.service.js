import * as reactionRepository from "../repositories/reaction.repository.js";
import * as messageRepository from "../repositories/message.repository.js";
import { requireMember } from "./authorization.service.js";

const MAX_EMOJI_CODEPOINTS = 16;

function validateEmoji(emoji) {
  if (typeof emoji !== "string" || !emoji.trim()) {
    const error = new Error("Emoji is required.");
    error.statusCode = 400;
    error.code = "INVALID_EMOJI";
    throw error;
  }

  const trimmed = emoji.trim();

  // Check codepoint length
  if ([...trimmed].length > MAX_EMOJI_CODEPOINTS) {
    const error = new Error("Emoji is too long.");
    error.statusCode = 400;
    error.code = "INVALID_EMOJI";
    throw error;
  }

  return trimmed;
}

async function loadAndVerifyMessage({ conversationId, messageId }) {
  const message = await messageRepository.findById(null, messageId);

  if (!message || message.conversation_id !== conversationId) {
    const error = new Error("Message not found.");
    error.statusCode = 404;
    error.code = "MESSAGE_NOT_FOUND";
    throw error;
  }

  if (message.deleted_at) {
    const error = new Error("Cannot react to a deleted message.");
    error.statusCode = 409;
    error.code = "MESSAGE_ALREADY_DELETED";
    throw error;
  }

  return message;
}

export async function addReaction({ userId, conversationId, messageId, emoji }) {
  await requireMember({ conversationId, userId });

  const validEmoji = validateEmoji(emoji);
  await loadAndVerifyMessage({ conversationId, messageId });

  const result = await reactionRepository.addReaction(null, {
    messageId,
    userId,
    emoji: validEmoji,
  });

  // ON CONFLICT DO NOTHING returns null for duplicate — treat as idempotent success
  return result || { message_id: messageId, user_id: userId, emoji: validEmoji, created_at: new Date() };
}

export async function removeReaction({ userId, conversationId, messageId, emoji }) {
  await requireMember({ conversationId, userId });

  const validEmoji = validateEmoji(emoji);

  const result = await reactionRepository.removeReaction(null, {
    messageId,
    userId,
    emoji: validEmoji,
  });

  if (!result) {
    const error = new Error("Reaction not found.");
    error.statusCode = 404;
    error.code = "REACTION_NOT_FOUND";
    throw error;
  }

  return result;
}
