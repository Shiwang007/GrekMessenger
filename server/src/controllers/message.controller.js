import * as messageService from "../services/message.service.js";

export async function createMessage(req, res, next) {
  try {
    const { conversationId } = req.params;
    const { clientMessageId, content } = req.body;

    // Security: senderId is derived exclusively from authenticated JWT
    const message = await messageService.createMessage({
      conversationId,
      senderId: req.user.id,
      clientMessageId,
      content,
    });

    return res.status(201).json({
      message: messageService.toMessageResponse(message),
    });
  } catch (error) {
    next(error);
  }
}

export async function listMessages(req, res, next) {
  try {
    const { conversationId } = req.params;
    const { limit, before } = req.query;

    const result = await messageService.listMessages({
      conversationId,
      userId: req.user.id,
      limit,
      before,
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
