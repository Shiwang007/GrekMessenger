import * as messageService from "../../services/message.service.js";
import { conversationRoom } from "../rooms/roomNames.js";
import { toSocketError } from "../utils/socketError.js";

export function registerEditDeleteHandlers(io, socket) {
  const userId = socket.user?.id;
  if (!userId) return;

  // Edit own message
  socket.on("message:edit", async (payload, ack) => {
    try {
      const { conversationId, messageId, content } = payload ?? {};

      if (!conversationId || !messageId || !content) {
        return ack?.({ ok: false, error: { code: "INVALID_PAYLOAD", message: "Missing required fields." } });
      }

      const message = await messageService.editMessage({
        userId,
        conversationId,
        messageId,
        content,
      });

      io.to(conversationRoom(conversationId)).emit("message:edited", { message });

      ack?.({ ok: true, message });
    } catch (error) {
      ack?.(toSocketError(error));
    }
  });

  // Delete own message (10-min window)
  socket.on("message:delete", async (payload, ack) => {
    try {
      const { conversationId, messageId } = payload ?? {};

      if (!conversationId || !messageId) {
        return ack?.({ ok: false, error: { code: "INVALID_PAYLOAD", message: "Missing required fields." } });
      }

      const result = await messageService.deleteMessage({
        userId,
        conversationId,
        messageId,
      });

      io.to(conversationRoom(conversationId)).emit("message:deleted", {
        conversationId,
        messageId: result.id,
        deletedAt: result.deletedAt,
      });

      ack?.({ ok: true });
    } catch (error) {
      ack?.(toSocketError(error));
    }
  });
}
