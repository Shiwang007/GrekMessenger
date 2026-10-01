import * as conversationService from "../services/conversation.service.js";

export async function createDirectConversation(req, res, next) {
  try {
    const conversation = await conversationService.getOrCreateDirectConversation({
      currentUserId: req.user.id,
      targetUserId: req.body.userId,
    });

    return res.status(200).json({
      conversation,
    });
  } catch (error) {
    next(error);
  }
}

export async function getConversation(req, res, next) {
  try {
    const conversation = await conversationService.getConversation({
      conversationId: req.params.conversationId,
      userId: req.user.id,
    });

    if (!conversation) {
      return res.status(404).json({
        error: {
          code: "CONVERSATION_NOT_FOUND",
          message: "Conversation not found.",
        },
      });
    }

    return res.status(200).json({
      conversation,
    });
  } catch (error) {
    next(error);
  }
}

export async function listConversations(req, res, next) {
  try {
    const conversations = await conversationService.listConversations(req.user.id);

    return res.status(200).json({
      conversations,
    });
  } catch (error) {
    next(error);
  }
}
