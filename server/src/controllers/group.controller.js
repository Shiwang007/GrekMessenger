import * as groupService from "../services/group.service.js";
import {
  notifyConversationCreated,
  notifyGroupMemberAdded,
  notifyGroupMemberRemoved,
  notifyGroupDeleted,
} from "../socket/notifications.js";
import { getIO } from "../socket/index.js";
import { conversationRoom, userRoom } from "../socket/rooms/roomNames.js";

export async function createGroup(req, res, next) {
  try {
    const { name, avatarUrl } = req.body;
    const conversation = await groupService.createGroup({
      creatorId: req.user.id,
      name,
      avatarUrl,
    });

    const io = req.app.get("io") || getIO();
    if (io) {
      io.in(userRoom(req.user.id)).socketsJoin(conversationRoom(conversation.id));
    }

    return res.status(201).json({
      conversation,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateGroup(req, res, next) {
  try {
    const { conversationId } = req.params;
    const { name, avatarUrl } = req.body;

    const conversation = await groupService.updateGroup({
      conversationId,
      userId: req.user.id,
      name,
      avatarUrl,
    });

    const io = req.app.get("io") || getIO();
    if (io) {
      io.to(conversationRoom(conversationId)).emit("group:updated", {
        conversationId,
        conversation,
      });
    }

    return res.status(200).json({
      conversation,
    });
  } catch (error) {
    next(error);
  }
}

export async function addMember(req, res, next) {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;

    const member = await groupService.addMember({
      conversationId,
      actorId: req.user.id,
      targetUserId: userId,
    });

    // Notify newly added user so their sidebar receives the group conversation immediately
    notifyConversationCreated(conversationId, userId).catch(() => {});

    // Broadcast member addition to current group room members
    notifyGroupMemberAdded(conversationId, member).catch(() => {});

    return res.status(201).json({
      member,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeMember(req, res, next) {
  try {
    const { conversationId, userId } = req.params;

    const result = await groupService.removeMember({
      conversationId,
      actorId: req.user.id,
      targetUserId: userId,
    });

    // Notify removed user and existing room members
    notifyGroupMemberRemoved(conversationId, userId).catch(() => {});

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function changeMemberRole(req, res, next) {
  try {
    const { conversationId, userId } = req.params;
    const { role } = req.body;

    const result = await groupService.changeMemberRole({
      conversationId,
      actorId: req.user.id,
      targetUserId: userId,
      newRole: role,
    });

    const io = req.app.get("io") || getIO();
    if (io) {
      io.to(conversationRoom(conversationId)).emit("group:role_changed", {
        conversationId,
        userId,
        role,
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function transferOwnership(req, res, next) {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;

    const result = await groupService.transferOwnership({
      conversationId,
      currentOwnerId: req.user.id,
      newOwnerId: userId,
    });

    const io = req.app.get("io") || getIO();
    if (io) {
      io.to(conversationRoom(conversationId)).emit("group:ownership_transferred", {
        conversationId,
        previousOwnerId: req.user.id,
        newOwnerId: userId,
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function deleteGroup(req, res, next) {
  try {
    const { conversationId } = req.params;

    const result = await groupService.deleteGroup({
      conversationId,
      userId: req.user.id,
    });

    notifyGroupDeleted(conversationId).catch(() => {});

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
