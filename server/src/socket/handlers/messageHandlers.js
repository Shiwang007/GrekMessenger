import * as messageService from "../../services/message.service.js";
import { conversationRoom, userRoom } from "../rooms/roomNames.js";
import { stopTyping } from "../typing/typingManager.js";
import { getUnreadCountsForOtherMembers } from "../../services/unread.service.js";

export function mapMessageError(error) {
  switch (error?.code) {
    case "CONVERSATION_ACCESS_DENIED":
    case "CONVERSATION_NOT_FOUND":
    case "FORBIDDEN":
      return "CONVERSATION_ACCESS_DENIED";

    case "INVALID_MESSAGE":
    case "INVALID_CLIENT_MESSAGE_ID":
    case "INVALID_CONVERSATION_ID":
      return "INVALID_MESSAGE";

    case "MESSAGE_TOO_LONG":
    case "MESSAGE_TOO_LARGE":
      return "MESSAGE_TOO_LARGE";

    default:
      return "MESSAGE_SEND_FAILED";
  }
}

export function registerMessageHandlers(io, socket) {
  socket.on("message:send", async (payload, callback) => {
    try {
      const { conversationId, clientMessageId, content } = payload ?? {};

      if (!conversationId || typeof conversationId !== "string") {
        const error = new Error("Invalid conversation ID.");
        error.code = "INVALID_CONVERSATION_ID";
        throw error;
      }

      // Security: senderId is derived exclusively from authenticated JWT on the socket
      const result = await messageService.createMessage({
        conversationId,
        senderId: socket.user.id,
        clientMessageId,
        content,
      });

      // Clear typing state for sender on send
      const { wasTyping } = stopTyping({ conversationId, userId: socket.user.id });
      if (wasTyping) {
        socket.to(conversationRoom(conversationId)).emit("typing:update", {
          conversationId,
          userId: socket.user.id,
          typing: false,
        });
      }

      if (result.duplicate) {
        callback?.({
          ok: true,
          duplicate: true,
          message: result.message,
        });
        return;
      }

      // Broadcast canonical persisted message to all connected members in the room
      io.to(conversationRoom(conversationId)).emit("message:new", result.message);

      // Asynchronously update unread counts for all other conversation members
      getUnreadCountsForOtherMembers({
        conversationId,
        senderId: socket.user.id,
      })
        .then((memberCounts) => {
          for (const { userId: memberId, unreadCount } of memberCounts) {
            io.to(userRoom(memberId)).emit("unread:update", {
              conversationId,
              unreadCount,
            });
          }
        })
        .catch(() => {});

      // Acknowledge sender with success and non-duplicate status
      callback?.({
        ok: true,
        duplicate: false,
        message: result.message,
      });
    } catch (error) {
      const code = mapMessageError(error);
      callback?.({
        ok: false,
        code,
      });
    }
  });
}
