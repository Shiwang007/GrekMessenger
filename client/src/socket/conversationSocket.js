import { socket } from "./socket";

export function joinConversation(conversationId) {
  return new Promise((resolve, reject) => {
    if (!conversationId) {
      reject(new Error("INVALID_CONVERSATION_ID"));
      return;
    }

    if (!socket.connected) {
      reject(new Error("SOCKET_NOT_CONNECTED"));
      return;
    }

    socket.emit("conversation:join", { conversationId }, (response) => {
      if (!response?.ok) {
        reject(new Error(response?.code || "CONVERSATION_JOIN_FAILED"));
        return;
      }
      resolve(response);
    });
  });
}

export function leaveConversation(conversationId) {
  return new Promise((resolve, reject) => {
    if (!conversationId || !socket.connected) {
      resolve();
      return;
    }

    socket.emit("conversation:leave", { conversationId }, (response) => {
      if (!response?.ok) {
        reject(new Error(response?.code || "CONVERSATION_LEAVE_FAILED"));
        return;
      }
      resolve(response);
    });
  });
}

export function sendSocketMessage({ conversationId, clientMessageId, content }) {
  return new Promise((resolve, reject) => {
    if (!conversationId || !clientMessageId || !content) {
      reject(new Error("INVALID_MESSAGE_PAYLOAD"));
      return;
    }

    if (!socket.connected) {
      reject(new Error("SOCKET_NOT_CONNECTED"));
      return;
    }

    socket.emit(
      "message:send",
      { conversationId, clientMessageId, content },
      (response) => {
        if (!response?.ok) {
          reject(new Error(response?.code || "MESSAGE_SEND_FAILED"));
          return;
        }
        resolve(response);
      }
    );
  });
}

export function sendTypingStart(conversationId) {
  if (!conversationId || !socket.connected) return;
  socket.emit("typing:start", { conversationId });
}

export function sendTypingStop(conversationId) {
  if (!conversationId || !socket.connected) return;
  socket.emit("typing:stop", { conversationId });
}

export function sendDeliveryReceipt(messageId) {
  if (!messageId || !socket.connected) return;
  socket.emit("message:delivered", { messageId });
}

export function sendConversationRead(conversationId, messageId, callback) {
  if (!conversationId || !messageId || !socket.connected) return;
  socket.emit("conversation:read", { conversationId, messageId }, callback);
}

export function sendMessageEdit({ conversationId, messageId, content }, callback) {
  if (!conversationId || !messageId || !content || !socket.connected) return;
  socket.emit("message:edit", { conversationId, messageId, content }, callback);
}

export function sendMessageDelete({ conversationId, messageId }, callback) {
  if (!conversationId || !messageId || !socket.connected) return;
  socket.emit("message:delete", { conversationId, messageId }, callback);
}

export function sendReactionAdd({ conversationId, messageId, emoji }, callback) {
  if (!conversationId || !messageId || !emoji || !socket.connected) return;
  socket.emit("reaction:add", { conversationId, messageId, emoji }, callback);
}

export function sendReactionRemove({ conversationId, messageId, emoji }, callback) {
  if (!conversationId || !messageId || !emoji || !socket.connected) return;
  socket.emit("reaction:remove", { conversationId, messageId, emoji }, callback);
}



