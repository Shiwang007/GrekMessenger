import { useEffect, useRef, useCallback } from "react";
import MessageItem from "./MessageItem";
import Spinner from "../common/Spinner";
import { ChatIcon } from "../common/Icons";

export default function MessageList({
  messages = [],
  currentUserId,
  isGroup = false,
  loading = false,
  loadingOlder = false,
  hasMore = false,
  onLoadOlder,
  onRetryMessage,
  onMessageVisible,
  onEdit,
  onDelete,
  onReactionToggle,
}) {
  const containerRef = useRef(null);
  const bottomSentinelRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const prevMessagesLengthRef = useRef(messages.length);
  const messageRefsRef = useRef(new Map());
  const observerRef = useRef(null);

  // Track which incoming messages become visible via IntersectionObserver
  useEffect(() => {
    if (!onMessageVisible || !currentUserId) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        let newestVisibleId = null;
        let newestVisibleTime = null;

        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target;
          const senderId = el.dataset.senderId;
          const messageId = el.dataset.messageId;
          const createdAt = el.dataset.createdAt;

          // Only track incoming messages (not own)
          if (senderId === currentUserId || !messageId || messageId.startsWith("temp")) continue;

          const time = createdAt ? new Date(createdAt).getTime() : 0;
          if (!newestVisibleId || time > newestVisibleTime) {
            newestVisibleId = messageId;
            newestVisibleTime = time;
          }
        }

        if (newestVisibleId) {
          onMessageVisible(newestVisibleId);
        }
      },
      { threshold: 0.6 }
    );

    // Observe all currently rendered message elements
    for (const el of messageRefsRef.current.values()) {
      if (el) observerRef.current.observe(el);
    }

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [onMessageVisible, currentUserId, messages]);

  const setMessageRef = useCallback((id, el) => {
    if (el) {
      messageRefsRef.current.set(id, el);
      observerRef.current?.observe(el);
    } else {
      const prev = messageRefsRef.current.get(id);
      if (prev) observerRef.current?.unobserve(prev);
      messageRefsRef.current.delete(id);
    }
  }, []);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loading && messages.length > 0 && isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      bottomSentinelRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [loading, messages]);

  // When a new message is appended (sent by user or received)
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      // If we didn't just prepend older messages, scroll down
      const container = containerRef.current;
      if (container) {
        const isNearBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight < 180;
        const lastMessage = messages[messages.length - 1];
        const isMyMessage = lastMessage?.senderId === currentUserId;

        if (isNearBottom || isMyMessage) {
          bottomSentinelRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, currentUserId]);

  // Handle upward infinite scroll with scroll position preservation
  function handleScroll(e) {
    const container = e.currentTarget;
    if (container.scrollTop <= 80 && hasMore && !loadingOlder && !loading) {
      const prevHeight = container.scrollHeight;
      const prevTop = container.scrollTop;

      onLoadOlder().then(() => {
        requestAnimationFrame(() => {
          if (containerRef.current) {
            const newHeight = containerRef.current.scrollHeight;
            containerRef.current.scrollTop = prevTop + (newHeight - prevHeight);
          }
        });
      });
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-3">
        <Spinner size="lg" />
        <p className="text-xs text-slate-400">Loading messages...</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3">
          <ChatIcon className="w-7 h-7" />
        </div>
        <h3 className="text-base font-semibold text-white mb-1">No messages yet</h3>
        <p className="text-xs text-slate-400 max-w-xs">
          Send the first message to start the conversation! Say hello 👋
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 min-h-0 overflow-y-auto px-2 sm:px-4 py-3 flex flex-col"
    >
      {/* Loading older indicator */}
      {loadingOlder && (
        <div className="flex items-center justify-center py-2 space-x-2 text-xs text-indigo-300">
          <Spinner size="sm" />
          <span>Loading older messages...</span>
        </div>
      )}

      {/* Start of conversation banner */}
      {!hasMore && (
        <div className="text-center py-3 my-2 text-[11px] text-slate-400 border-b border-white/5">
          Beginning of conversation history
        </div>
      )}

      {/* Message items */}
      <div className="flex-1 flex flex-col justify-end">
        {messages.map((message) => (
          <MessageItem
            key={message.id || message.clientMessageId}
            message={message}
            currentUserId={currentUserId}
            isGroup={isGroup}
            onRetry={onRetryMessage}
            onEdit={onEdit}
            onDelete={onDelete}
            onReactionToggle={onReactionToggle}
            innerRef={(el) =>
              setMessageRef(message.id || message.clientMessageId, el)
            }
          />
        ))}
      </div>

      {/* Scroll to bottom sentinel */}
      <div ref={bottomSentinelRef} className="h-0 w-0" />
    </div>
  );
}
