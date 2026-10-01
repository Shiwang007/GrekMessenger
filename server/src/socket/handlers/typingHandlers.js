import { startTyping, stopTyping } from "../typing/typingManager.js";
import { requireMember } from "../../services/authorization.service.js";
import { conversationRoom } from "../rooms/roomNames.js";

export function registerTypingHandlers(io, socket) {
  const userId = socket.user?.id;
  if (!userId) return;

  socket.on("typing:start", async (payload) => {
    try {
      const conversationId = payload?.conversationId;
      if (!conversationId || typeof conversationId !== "string") return;

      // Verify active membership in conversation
      await requireMember({
        conversationId,
        userId,
      });

      const room = conversationRoom(conversationId);

      const result = startTyping({
        conversationId,
        userId,
        onExpire: () => {
          // Broadcast typing stop to other room members when timeout triggers
          socket.to(room).emit("typing:update", {
            conversationId,
            userId,
            typing: false,
          });
        },
      });

      // Broadcast typing start only if state transitioned from not typing -> typing
      if (result.becameTyping) {
        socket.to(room).emit("typing:update", {
          conversationId,
          userId,
          typing: true,
        });
      }
    } catch {
      // Do not expose authorization details through typing events
    }
  });

  socket.on("typing:stop", async (payload) => {
    try {
      const conversationId = payload?.conversationId;
      if (!conversationId || typeof conversationId !== "string") return;

      // Verify active membership in conversation
      await requireMember({
        conversationId,
        userId,
      });

      const result = stopTyping({
        conversationId,
        userId,
      });

      // Broadcast typing stop only if user was actively typing
      if (result.wasTyping) {
        const room = conversationRoom(conversationId);
        socket.to(room).emit("typing:update", {
          conversationId,
          userId,
          typing: false,
        });
      }
    } catch {
      // Ignore unauthorized or invalid requests
    }
  });
}
