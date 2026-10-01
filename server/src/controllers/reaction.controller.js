import * as messageService from "../services/message.service.js";
import * as reactionService from "../services/reaction.service.js";

export async function editMessage(req, res, next) {
  try {
    const { conversationId, messageId } = req.params;
    const { content } = req.body;

    const message = await messageService.editMessage({
      userId: req.user.id,
      conversationId,
      messageId,
      content,
    });

    return res.json({ ok: true, message });
  } catch (error) {
    next(error);
  }
}

export async function deleteMessage(req, res, next) {
  try {
    const { conversationId, messageId } = req.params;

    const result = await messageService.deleteMessage({
      userId: req.user.id,
      conversationId,
      messageId,
    });

    return res.json({
      ok: true,
      message: {
        id: result.id,
        conversationId: result.conversationId,
        senderId: result.senderId,
        content: null,
        deletedAt: result.deletedAt,
        reactions: [],
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function addReaction(req, res, next) {
  try {
    const { conversationId, messageId } = req.params;
    const { emoji } = req.body;

    const reaction = await reactionService.addReaction({
      userId: req.user.id,
      conversationId,
      messageId,
      emoji,
    });

    return res.json({ ok: true, reaction });
  } catch (error) {
    next(error);
  }
}

export async function removeReaction(req, res, next) {
  try {
    const { conversationId, messageId, emoji } = req.params;

    await reactionService.removeReaction({
      userId: req.user.id,
      conversationId,
      messageId,
      emoji: decodeURIComponent(emoji),
    });

    return res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}
