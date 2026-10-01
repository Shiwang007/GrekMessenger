import { Server } from "socket.io";
import { socketAuth } from "./middleware/socketAuth.js";
import { scheduleTokenExpiry } from "./auth/socketExpiry.js";
import { registerConversationHandlers } from "./handlers/conversationHandlers.js";
import { registerMessageHandlers } from "./handlers/messageHandlers.js";
import { registerTypingHandlers } from "./handlers/typingHandlers.js";
import { registerReceiptHandlers } from "./handlers/receiptHandlers.js";
import { registerEditDeleteHandlers } from "./handlers/editDeleteHandlers.js";
import { registerReactionHandlers } from "./handlers/reactionHandlers.js";

import { pool } from "../config/database.js";
import { logger } from "../utils/logger.js";
import { addSocket, removeSocket } from "../presence/presenceManager.js";
import { markLastSeen, broadcastPresence } from "../presence/presenceService.js";
import { cleanupUserTyping } from "./typing/typingManager.js";
import { conversationRoom, userRoom } from "./rooms/roomNames.js";

let ioInstance = null;

export function getIO() {
  return ioInstance;
}

export function registerSocketHandlers(io) {
  ioInstance = io;
  io.use(socketAuth);

  io.on("connection", async (socket) => {
    const userId = socket.user?.id;

    if (userId) {
      socket.join(userRoom(userId));

      // Auto-join socket to all active conversation rooms for real-time delivery
      try {
        const { rows } = await pool.query(
          "SELECT conversation_id FROM conversation_members WHERE user_id = $1 AND removed_at IS NULL",
          [userId]
        );
        for (const row of rows) {
          socket.join(conversationRoom(row.conversation_id));
        }
      } catch (err) {
        logger.error(`Failed to auto-join conversation rooms for user ${userId}:`, err);
      }

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
  const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(",").map((s) => s.trim())
    : ["http://localhost:5173"];

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  registerSocketHandlers(io);

  return io;
}
