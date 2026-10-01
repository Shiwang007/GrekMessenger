import { pool } from "../config/database.js";
import { ROLES, isValidRole } from "../constants/roles.js";
import { findUserById } from "../repositories/auth.repository.js";
import * as conversationRepository from "../repositories/conversation.repository.js";
import * as membershipRepository from "../repositories/membership.repository.js";
import * as authService from "./authorization.service.js";

export async function createGroup({ creatorId, name, avatarUrl = null }) {
  const trimmedName = name?.trim();
  if (!trimmedName) {
    const error = new Error("Group name is required.");
    error.statusCode = 400;
    error.code = "INVALID_GROUP_NAME";
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const conversation = await conversationRepository.createGroup(client, {
      name: trimmedName,
      avatarUrl: avatarUrl?.trim() || null,
      createdBy: creatorId,
    });

    await membershipRepository.addMember(client, {
      conversationId: conversation.id,
      userId: creatorId,
      role: ROLES.OWNER,
    });

    await client.query("COMMIT");

    const members = await membershipRepository.getConversationMembers(null, conversation.id);

    return {
      id: conversation.id,
      type: conversation.type,
      name: conversation.name,
      avatarUrl: conversation.avatar_url,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      currentUserRole: ROLES.OWNER,
      members,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateGroup({ conversationId, userId, name, avatarUrl }) {
  await authService.requireAdmin({ conversationId, userId });

  const conversation = await conversationRepository.findConversationById(null, conversationId);
  if (!conversation) {
    const error = new Error("Conversation not found.");
    error.statusCode = 404;
    error.code = "CONVERSATION_NOT_FOUND";
    throw error;
  }
  authService.requireGroupConversation(conversation);

  const updates = {};
  if (name !== undefined) {
    const trimmed = name.trim();
    if (!trimmed) {
      const error = new Error("Group name cannot be empty.");
      error.statusCode = 400;
      error.code = "INVALID_GROUP_NAME";
      throw error;
    }
    updates.name = trimmed;
  }

  if (avatarUrl !== undefined) {
    updates.avatarUrl = avatarUrl ? avatarUrl.trim() : null;
  }

  const updated = await conversationRepository.updateGroup(null, conversationId, updates);
  const members = await membershipRepository.getConversationMembers(null, conversationId);
  const membership = await authService.getMembership({ conversationId, userId });

  return {
    id: updated.id,
    type: updated.type,
    name: updated.name,
    avatarUrl: updated.avatar_url,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
    currentUserRole: membership?.role,
    members,
  };
}

export async function addMember({ conversationId, actorId, targetUserId }) {
  await authService.requireAdmin({ conversationId, actorId });

  const conversation = await conversationRepository.findConversationById(null, conversationId);
  if (!conversation) {
    const error = new Error("Conversation not found.");
    error.statusCode = 404;
    error.code = "CONVERSATION_NOT_FOUND";
    throw error;
  }
  authService.requireGroupConversation(conversation);

  if (!targetUserId) {
    const error = new Error("Target user ID is required.");
    error.statusCode = 400;
    error.code = "INVALID_TARGET_USER";
    throw error;
  }

  const targetUser = await findUserById(targetUserId);
  if (!targetUser) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    error.code = "USER_NOT_FOUND";
    throw error;
  }

  // Add target with strict MEMBER role
  const member = await membershipRepository.addMember(null, {
    conversationId,
    userId: targetUserId,
    role: ROLES.MEMBER,
  });

  return {
    id: targetUser.id,
    name: targetUser.name,
    email: targetUser.email,
    avatarUrl: targetUser.avatar_url,
    role: member.role,
    joinedAt: member.joined_at,
  };
}

export async function removeMember({ conversationId, actorId, targetUserId }) {
  const actorMembership = await authService.requireAdmin({ conversationId, actorId });

  const conversation = await conversationRepository.findConversationById(null, conversationId);
  if (!conversation) {
    const error = new Error("Conversation not found.");
    error.statusCode = 404;
    error.code = "CONVERSATION_NOT_FOUND";
    throw error;
  }
  authService.requireGroupConversation(conversation);

  const targetMembership = await membershipRepository.findActiveMembership({
    conversationId,
    userId: targetUserId,
  });

  if (!targetMembership) {
    const error = new Error("Member not found in this conversation.");
    error.statusCode = 404;
    error.code = "MEMBER_NOT_FOUND";
    throw error;
  }

  if (targetMembership.role === ROLES.OWNER) {
    const error = new Error("The group owner cannot be removed. Transfer ownership first.");
    error.statusCode = 400;
    error.code = "OWNER_CANNOT_BE_REMOVED";
    throw error;
  }

  // Admins can remove normal members, but NOT other admins or owner
  if (actorMembership.role === ROLES.ADMIN) {
    if (targetMembership.role === ROLES.ADMIN || targetMembership.role === ROLES.OWNER) {
      const error = new Error("Admins cannot remove other admins or owners.");
      error.statusCode = 403;
      error.code = "FORBIDDEN";
      throw error;
    }
  }

  await membershipRepository.removeMember(null, { conversationId, userId: targetUserId });

  return {
    success: true,
    removedUserId: targetUserId,
  };
}

export async function changeMemberRole({ conversationId, actorId, targetUserId, newRole }) {
  await authService.requireOwner({ conversationId, actorId });

  const conversation = await conversationRepository.findConversationById(null, conversationId);
  if (!conversation) {
    const error = new Error("Conversation not found.");
    error.statusCode = 404;
    error.code = "CONVERSATION_NOT_FOUND";
    throw error;
  }
  authService.requireGroupConversation(conversation);

  if (!isValidRole(newRole)) {
    const error = new Error("Invalid role specified.");
    error.statusCode = 400;
    error.code = "INVALID_ROLE";
    throw error;
  }

  if (newRole === ROLES.OWNER) {
    const error = new Error("Cannot set OWNER role directly. Use transfer ownership endpoint.");
    error.statusCode = 400;
    error.code = "INVALID_ROLE_CHANGE";
    throw error;
  }

  if (actorId === targetUserId) {
    const error = new Error("Owner cannot change their own role. Transfer ownership instead.");
    error.statusCode = 400;
    error.code = "INVALID_ROLE_CHANGE";
    throw error;
  }

  const targetMembership = await membershipRepository.findActiveMembership({
    conversationId,
    userId: targetUserId,
  });

  if (!targetMembership) {
    const error = new Error("Member not found in this conversation.");
    error.statusCode = 404;
    error.code = "MEMBER_NOT_FOUND";
    throw error;
  }

  const updated = await membershipRepository.updateMemberRole(null, {
    conversationId,
    userId: targetUserId,
    role: newRole,
  });

  return {
    userId: targetUserId,
    role: updated.role,
  };
}

export async function transferOwnership({ conversationId, currentOwnerId, newOwnerId }) {
  await authService.requireOwner({ conversationId, userId: currentOwnerId });

  const conversation = await conversationRepository.findConversationById(null, conversationId);
  if (!conversation) {
    const error = new Error("Conversation not found.");
    error.statusCode = 404;
    error.code = "CONVERSATION_NOT_FOUND";
    throw error;
  }
  authService.requireGroupConversation(conversation);

  if (currentOwnerId === newOwnerId) {
    const error = new Error("You are already the owner of this group.");
    error.statusCode = 400;
    error.code = "INVALID_OWNERSHIP_TRANSFER";
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock conversation row to prevent concurrent transfer races
    await client.query(
      "SELECT id FROM conversations WHERE id = $1 FOR UPDATE",
      [conversationId]
    );

    const result = await membershipRepository.transferOwnership(client, {
      conversationId,
      currentOwnerId,
      newOwnerId,
    });

    await client.query("COMMIT");

    const members = await membershipRepository.getConversationMembers(null, conversationId);

    return {
      success: true,
      conversationId,
      roles: result,
      members,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteGroup({ conversationId, userId }) {
  await authService.requireOwner({ conversationId, userId });

  const conversation = await conversationRepository.findConversationById(null, conversationId);
  if (!conversation) {
    const error = new Error("Conversation not found.");
    error.statusCode = 404;
    error.code = "CONVERSATION_NOT_FOUND";
    throw error;
  }
  authService.requireGroupConversation(conversation);

  await conversationRepository.deleteGroup(null, conversationId);

  return {
    success: true,
    deletedConversationId: conversationId,
  };
}
