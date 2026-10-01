// In-memory ephemeral typing state: conversationId -> Map<userId, NodeJS.Timeout>
const typingConversations = new Map();

/**
 * Start or refresh typing state for a user in a conversation.
 * @param {Object} params
 * @param {string} params.conversationId
 * @param {string} params.userId
 * @param {Function} params.onExpire - Callback triggered when timer expires without a stop event
 * @param {number} [params.timeoutMs=3000]
 * @returns {{ becameTyping: boolean }}
 */
export function startTyping({ conversationId, userId, onExpire, timeoutMs = 3000 }) {
  if (!conversationId || !userId) {
    return { becameTyping: false };
  }

  let conversationTyping = typingConversations.get(conversationId);
  if (!conversationTyping) {
    conversationTyping = new Map();
    typingConversations.set(conversationId, conversationTyping);
  }

  const existingTimer = conversationTyping.get(userId);
  const wasAlreadyTyping = Boolean(existingTimer);

  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    const currentConv = typingConversations.get(conversationId);
    if (currentConv) {
      currentConv.delete(userId);
      if (currentConv.size === 0) {
        typingConversations.delete(conversationId);
      }
    }
    onExpire?.();
  }, timeoutMs);

  conversationTyping.set(userId, timer);

  return { becameTyping: !wasAlreadyTyping };
}

/**
 * Stop typing state for a user in a conversation.
 * @param {Object} params
 * @param {string} params.conversationId
 * @param {string} params.userId
 * @returns {{ wasTyping: boolean }}
 */
export function stopTyping({ conversationId, userId }) {
  const conversationTyping = typingConversations.get(conversationId);
  if (!conversationTyping) {
    return { wasTyping: false };
  }

  const timer = conversationTyping.get(userId);
  if (timer) {
    clearTimeout(timer);
  }

  const wasTyping = conversationTyping.delete(userId);
  if (conversationTyping.size === 0) {
    typingConversations.delete(conversationId);
  }

  return { wasTyping };
}

/**
 * Clean up all typing entries for a given user across all conversations (e.g. on disconnect).
 * @param {Object} params
 * @param {string} params.userId
 * @returns {string[]} conversationIds where the user was actively typing and got removed
 */
export function cleanupUserTyping({ userId }) {
  if (!userId) return [];

  const affectedConversationIds = [];

  for (const [conversationId, userMap] of typingConversations.entries()) {
    if (userMap.has(userId)) {
      const timer = userMap.get(userId);
      if (timer) {
        clearTimeout(timer);
      }
      userMap.delete(userId);
      affectedConversationIds.push(conversationId);

      if (userMap.size === 0) {
        typingConversations.delete(conversationId);
      }
    }
  }

  return affectedConversationIds;
}

/**
 * Get active typing users for a given conversation.
 * @param {string} conversationId
 * @returns {string[]} List of typing user IDs
 */
export function getTypingUsers(conversationId) {
  const conversationTyping = typingConversations.get(conversationId);
  if (!conversationTyping) return [];
  return Array.from(conversationTyping.keys());
}
