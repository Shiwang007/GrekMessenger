import { Server } from "socket.io";
import { socketAuth } from "./middleware/socketAuth.js";
import { scheduleTokenExpiry } from "./auth/socketExpiry.js";
import { registerConversationHandlers } from "./handlers/conversationHandlers.js";
import { registerMessageHandlers } from "./handlers/messageHandlers.js";
import { registerTypingHandlers } from "./handlers/typingHandlers.js";
import { registerReceiptHandlers } from "./handlers/receiptHandlers.js";
import { registerEditDeleteHandlers } from "./handlers/editDeleteHandlers.js";
import { registerReactionHandlers } from "./handlers/reactionHandlers.js";

import { addSocket, removeSocket } from "../presence/presenceManager.js";
import { markLastSeen, broadcastPresence } from "../presence/presenceService.js";
import { cleanupUserTyping } from "./typing/typingManager.js";
import { conversationRoom, userRoom } from "./rooms/roomNames.js";

export function registerSocketHandlers(io) {
  io.use(socketAuth);

  io.on("connection", (socket) => {
    const userId = socket.user?.id;

    if (userId) {
      socket.join(userRoom(userId));

      const { becameOnline } = addSocket(userId, socket.id);
      if (becameOnline) {
        broadcastPresence(io, userId, { online: true, lastSeenAt: null });
      }
    }

    // Register room join/leave authorization handlers
    registerConversationHandlers(io, socket);

    // Register real-time message sending handlers
    registerMessageHandlers(io, socket);

    // Register real-time typing indicators
    registerTypingHandlers(io, socket);

    // Register delivery and read receipt handlers
    registerReceiptHandlers(io, socket);

    // Register message edit and delete handlers
    registerEditDeleteHandlers(io, socket);

    // Register emoji reaction handlers
    registerReactionHandlers(io, socket);

    // Schedule proactive disconnect upon JWT access token expiration
    scheduleTokenExpiry(socket);

    socket.on("disconnect", async (reason) => {
      if (userId) {
        // Clean up any ephemeral typing state across conversations
        const clearedConversations = cleanupUserTyping({ userId });
        for (const conversationId of clearedConversations) {
          io.to(conversationRoom(conversationId)).emit("typing:update", {
            conversationId,
            userId,
            typing: false,
          });
        }

        const { becameOffline } = removeSocket(userId, socket.id);
        if (becameOffline) {
          const lastSeenAt = await markLastSeen(userId);
          broadcastPresence(io, userId, { online: false, lastSeenAt });
        }
      }
    });
  });
}

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  registerSocketHandlers(io);

  return io;
}
