import { requireMember } from "../../services/authorization.service.js";
import { conversationRoom } from "../rooms/roomNames.js";

export function registerConversationHandlers(io, socket) {
  socket.on("conversation:join", async (payload, callback) => {
    const conversationId = payload?.conversationId;

    if (!conversationId || typeof conversationId !== "string") {
      const errPayload = {
        ok: false,
        conversationId: conversationId || null,
        code: "INVALID_CONVERSATION_ID",
      };
      socket.emit("conversation:join:error", errPayload);
      return callback?.(errPayload);
    }

    try {
      // Authorize membership against PostgreSQL
      await requireMember({
        conversationId,
        userId: socket.user.id,
      });

      const room = conversationRoom(conversationId);
      await socket.join(room);

      const successPayload = {
        ok: true,
        conversationId,
      };

      callback?.(successPayload);
      socket.emit("conversation:joined", successPayload);
    } catch {
      const deniedPayload = {
        ok: false,
        conversationId,
        code: "CONVERSATION_ACCESS_DENIED",
      };

      callback?.(deniedPayload);
      socket.emit("conversation:join:error", deniedPayload);
    }
  });

  socket.on("conversation:leave", async (payload, callback) => {
    const conversationId = payload?.conversationId;

    if (!conversationId || typeof conversationId !== "string") {
      const errPayload = {
        ok: false,
        conversationId: conversationId || null,
        code: "INVALID_CONVERSATION_ID",
      };
      return callback?.(errPayload);
    }

    const room = conversationRoom(conversationId);
    await socket.leave(room);

    const successPayload = {
      ok: true,
      conversationId,
    };

    callback?.(successPayload);
    socket.emit("conversation:left", successPayload);
  });
}
