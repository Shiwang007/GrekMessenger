import { getIO } from "./index.js";
import { conversationRoom, userRoom } from "./rooms/roomNames.js";
import * as conversationService from "../services/conversation.service.js";
import { logger } from "../utils/logger.js";

/**
 * Notify a target user that a new conversation has been created or they were added to it.
 * Automatically joins all connected sockets for that user to the conversation room.
 */
export async function notifyConversationCreated(conversationId, targetUserId) {
  const io = getIO();
  if (!io || !conversationId || !targetUserId) return;

  try {
    // 1. Join user's connected sockets to the conversation room
    io.in(userRoom(targetUserId)).socketsJoin(conversationRoom(conversationId));

    // 2. Format conversation payload specific to targetUser (with correct otherUser / member data)
    const conversation = await conversationService.getConversation({
      conversationId,
      userId: targetUserId,
    });

    if (conversation) {
      io.to(userRoom(targetUserId)).emit("conversation:created", conversation);
    }
  } catch (error) {
    logger.error(`Failed to notify conversation:created for user ${targetUserId}:`, error);
  }
}

/**
 * Notify conversation members when a new member is added to a group.
 */
export async function notifyGroupMemberAdded(conversationId, member) {
  const io = getIO();
  if (!io || !conversationId || !member) return;

  io.to(conversationRoom(conversationId)).emit("group:member_added", {
    conversationId,
    member,
  });
}

/**
 * Notify conversation members and target user when a member is removed.
 */
export async function notifyGroupMemberRemoved(conversationId, targetUserId) {
  const io = getIO();
  if (!io || !conversationId || !targetUserId) return;

  // 1. Notify target user their conversation was removed
  io.to(userRoom(targetUserId)).emit("conversation:removed", { conversationId });

  // 2. Broadcast to remaining room members
  io.to(conversationRoom(conversationId)).emit("group:member_removed", {
    conversationId,
    userId: targetUserId,
  });

  // 3. Remove user sockets from conversation room
  io.in(userRoom(targetUserId)).socketsLeave(conversationRoom(conversationId));
}

/**
 * Notify conversation members when a group is deleted.
 */
export async function notifyGroupDeleted(conversationId) {
  const io = getIO();
  if (!io || !conversationId) return;

  io.to(conversationRoom(conversationId)).emit("group:deleted", { conversationId });
  io.in(conversationRoom(conversationId)).socketsLeave(conversationRoom(conversationId));
}
