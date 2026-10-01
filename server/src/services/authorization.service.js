import { ROLES } from "../constants/roles.js";
import * as membershipRepository from "../repositories/membership.repository.js";

export async function getMembership({ conversationId, userId, actorId, currentOwnerId }, clientOrPool = null) {
  const uid = userId || actorId || currentOwnerId;
  return membershipRepository.findActiveMembership({ conversationId, userId: uid }, clientOrPool);
}

export async function requireMember({ conversationId, userId, actorId }, clientOrPool = null) {
  const membership = await getMembership({ conversationId, userId, actorId }, clientOrPool);

  if (!membership) {
    const error = new Error("Conversation not found.");
    error.statusCode = 404;
    error.code = "CONVERSATION_NOT_FOUND";
    throw error;
  }

  return membership;
}

export async function requireAdmin({ conversationId, userId, actorId }, clientOrPool = null) {
  const membership = await requireMember({ conversationId, userId, actorId }, clientOrPool);

  if (membership.role !== ROLES.ADMIN && membership.role !== ROLES.OWNER) {
    const error = new Error("You do not have permission to perform this action.");
    error.statusCode = 403;
    error.code = "FORBIDDEN";
    throw error;
  }

  return membership;
}

export async function requireOwner({ conversationId, userId, actorId }, clientOrPool = null) {
  const membership = await requireMember({ conversationId, userId, actorId }, clientOrPool);

  if (membership.role !== ROLES.OWNER) {
    const error = new Error("Only the group owner can perform this action.");
    error.statusCode = 403;
    error.code = "FORBIDDEN";
    throw error;
  }

  return membership;
}

export function requireGroupConversation(conversation) {
  if (conversation.type !== "GROUP") {
    const error = new Error("Action only applicable to group conversations.");
    error.statusCode = 400;
    error.code = "INVALID_CONVERSATION_TYPE";
    throw error;
  }
}
