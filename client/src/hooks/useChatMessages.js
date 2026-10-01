import { useState, useEffect, useCallback, useRef } from "react";
import { getMessages, sendMessage } from "../services/messageApi";
import { sendSocketMessage } from "../socket/conversationSocket";

/**
 * Merge new messages into current list while preserving idempotency and chronological order.
 */
export function mergeMessages(current, incoming) {
  const map = new Map();

  for (const m of current) {
    const key = m.clientMessageId || m.id;
    if (key) map.set(key, m);
  }

  for (const m of incoming) {
    if (m.clientMessageId && map.has(m.clientMessageId)) {
      map.delete(m.clientMessageId);
    }
    const key = m.id || m.clientMessageId;
    if (key) map.set(key, m);
  }

  const merged = Array.from(map.values());
  merged.sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    return timeA - timeB;
  });

  return merged;
}

export function useChatMessages({ conversationId, isConnected, user }) {
  const [messages, setMessages] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  // Reset and load latest message history when active conversationId changes
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setNextCursor(null);
      setHasMoreMessages(false);
      return;
    }

    let isCancelled = false;

    async function fetchHistory() {
      try {
        setLoadingMessages(true);
        const result = await getMessages(conversationId, { limit: 50 });
        if (isCancelled) return;

        setMessages(result.messages || []);
        setNextCursor(result.nextCursor || null);
        setHasMoreMessages(Boolean(result.nextCursor));
      } catch (err) {
        if (!isCancelled) {
          console.error("Failed to load message history:", err);
          setMessages([]);
        }
      } finally {
        if (!isCancelled) {
          setLoadingMessages(false);
        }
      }
    }

    fetchHistory();

    return () => {
      isCancelled = true;
    };
  }, [conversationId]);

  // Load older messages for pagination
  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || !nextCursor || loadingOlderMessages) return;

    try {
      setLoadingOlderMessages(true);
      const result = await getMessages(conversationId, {
        limit: 50,
        before: nextCursor,
      });

      setMessages((prev) => mergeMessages(result.messages || [], prev));
      setNextCursor(result.nextCursor || null);
      setHasMoreMessages(Boolean(result.nextCursor));
    } catch (err) {
      console.error("Failed to load older messages:", err);
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [conversationId, nextCursor, loadingOlderMessages]);

  // Send a message with optimistic UI and fallback between socket and REST
  const sendMessageOptimistic = useCallback(
    async ({ clientMessageId, content }, onConversationBump) => {
      if (!conversationId || sendingMessage) return;

      const optimisticMessage = {
        id: `temp-${clientMessageId}`,
        clientMessageId,
        conversationId,
        senderId: user?.id,
        content,
        createdAt: new Date().toISOString(),
        status: "sending",
        sender: {
          id: user?.id,
          name: user?.name,
          avatarUrl: user?.avatar_url,
        },
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        setSendingMessage(true);
        let canonicalMessage;

        if (isConnected) {
          const res = await sendSocketMessage({
            conversationId,
            clientMessageId,
            content,
          });
          canonicalMessage = res.message;
        } else {
          const result = await sendMessage(conversationId, {
            clientMessageId,
            content,
          });
          canonicalMessage = result.message;
        }

        setMessages((prev) => mergeMessages(prev, [canonicalMessage]));
        onConversationBump?.(canonicalMessage);
      } catch (err) {
        console.error("Message send failed:", err);
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMessageId === clientMessageId ? { ...m, status: "failed" } : m
          )
        );
      } finally {
        setSendingMessage(false);
      }
    },
    [conversationId, sendingMessage, isConnected, user]
  );

  // Retry sending a previously failed message
  const retryMessage = useCallback(
    async (failedMessage, onConversationBump) => {
      if (!failedMessage?.clientMessageId || !failedMessage?.content) return;

      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === failedMessage.clientMessageId
            ? { ...m, status: "sending" }
            : m
        )
      );

      try {
        let canonicalMessage;
        if (isConnected) {
          const res = await sendSocketMessage({
            conversationId: failedMessage.conversationId,
            clientMessageId: failedMessage.clientMessageId,
            content: failedMessage.content,
          });
          canonicalMessage = res.message;
        } else {
          const result = await sendMessage(failedMessage.conversationId, {
            clientMessageId: failedMessage.clientMessageId,
            content: failedMessage.content,
          });
          canonicalMessage = result.message;
        }

        setMessages((prev) => mergeMessages(prev, [canonicalMessage]));
        onConversationBump?.(canonicalMessage);
      } catch (err) {
        console.error("Retry message failed:", err);
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMessageId === failedMessage.clientMessageId
              ? { ...m, status: "failed" }
              : m
          )
        );
      }
    },
    [isConnected]
  );

  return {
    messages,
    setMessages,
    hasMoreMessages,
    loadingMessages,
    loadingOlderMessages,
    loadOlderMessages,
    sendMessageOptimistic,
    retryMessage,
  };
}
