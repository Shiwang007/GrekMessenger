import * as receiptService from "../../services/receipt.service.js";
import { conversationRoom, userRoom } from "../rooms/roomNames.js";

export function registerReceiptHandlers(io, socket) {
  const userId = socket.user?.id;
  if (!userId) return;

  // Handle client delivery acknowledgement
  socket.on("message:delivered", async (payload, callback) => {
    try {
      const messageId = payload?.messageId;
      if (!messageId || typeof messageId !== "string") {
        return callback?.({ ok: false, code: "INVALID_MESSAGE_ID" });
      }

      const receipt = await receiptService.markDelivered({
        messageId,
        userId,
      });

      if (!receipt) {
        // Own message or no-op
        return callback?.({ ok: true, noop: true });
      }

      // Broadcast receipt update to the conversation room
      io.to(conversationRoom(receipt.conversationId)).emit("message:receipt", receipt);

      callback?.({
        ok: true,
        receipt,
      });
    } catch (error) {
      callback?.({
        ok: false,
        code: error.code || "DELIVERY_UPDATE_FAILED",
      });
    }
  });

  // Handle conversation read progression up to target message
  socket.on("conversation:read", async (payload, callback) => {
    try {
      const { conversationId, messageId } = payload ?? {};
      if (!conversationId || !messageId) {
        return callback?.({ ok: false, code: "INVALID_READ_PAYLOAD" });
      }

      const result = await receiptService.markConversationRead({
        conversationId,
        messageId,
        userId,
      });

      // Update unread count for current user's connected sockets
      io.to(userRoom(userId)).emit("unread:update", {
        conversationId,
        unreadCount: result.unreadCount,
      });

      // If position advanced, notify room members of updated read state
      if (!result.monotonicIgnored) {
        io.to(conversationRoom(conversationId)).emit("message:receipt", {
          conversationId,
          messageId: result.messageId,
          userId,
          deliveredAt: result.deliveredAt,
          readAt: result.readAt,
          seenCount: result.seenCount,
          recipientCount: result.recipientCount,
        });
      }

      callback?.({
        ok: true,
        unreadCount: result.unreadCount,
      });
    } catch (error) {
      callback?.({
        ok: false,
        code: error.code || "READ_UPDATE_FAILED",
      });
    }
  });
}
