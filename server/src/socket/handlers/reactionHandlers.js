import * as reactionService from "../../services/reaction.service.js";
import { conversationRoom } from "../rooms/roomNames.js";
import { toSocketError } from "../utils/socketError.js";

export function registerReactionHandlers(io, socket) {
  const userId = socket.user?.id;
  if (!userId) return;

  // Add emoji reaction
  socket.on("reaction:add", async (payload, ack) => {
    try {
      const { conversationId, messageId, emoji } = payload ?? {};

      if (!conversationId || !messageId || !emoji) {
        return ack?.({ ok: false, error: { code: "INVALID_PAYLOAD", message: "Missing required fields." } });
      }

      const reaction = await reactionService.addReaction({
        userId,
        conversationId,
        messageId,
        emoji,
      });

      io.to(conversationRoom(conversationId)).emit("reaction:updated", {
        conversationId,
        messageId: reaction.message_id,
        userId: reaction.user_id,
        emoji: reaction.emoji,
        action: "added",
        createdAt: reaction.created_at,
      });

      ack?.({ ok: true });
    } catch (error) {
      ack?.(toSocketError(error));
    }
  });

  // Remove own emoji reaction
  socket.on("reaction:remove", async (payload, ack) => {
    try {
      const { conversationId, messageId, emoji } = payload ?? {};

      if (!conversationId || !messageId || !emoji) {
        return ack?.({ ok: false, error: { code: "INVALID_PAYLOAD", message: "Missing required fields." } });
      }

      const reaction = await reactionService.removeReaction({
        userId,
        conversationId,
        messageId,
        emoji,
      });

      io.to(conversationRoom(conversationId)).emit("reaction:updated", {
        conversationId,
        messageId: reaction.message_id,
        userId: reaction.user_id,
        emoji: reaction.emoji,
        action: "removed",
      });

      ack?.({ ok: true });
    } catch (error) {
      ack?.(toSocketError(error));
    }
  });
}
