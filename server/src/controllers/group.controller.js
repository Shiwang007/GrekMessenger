import * as groupService from "../services/group.service.js";

export async function createGroup(req, res, next) {
  try {
    const { name, avatarUrl } = req.body;
    const conversation = await groupService.createGroup({
      creatorId: req.user.id,
      name,
      avatarUrl,
    });

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

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
