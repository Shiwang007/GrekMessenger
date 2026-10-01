import { useState, useRef, useEffect, useCallback } from "react";
import { sendTypingStart, sendTypingStop } from "../socket/conversationSocket";

const TYPING_STOP_DELAY = 1500;
const TYPING_REFRESH_INTERVAL = 2000;

export function useMessageComposer({ conversationId, onSendMessage, sending = false }) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef(null);

  const typingTimeoutRef = useRef(null);
  const typingRefreshRef = useRef(null);
  const isTypingRef = useRef(false);

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (typingRefreshRef.current) {
      clearInterval(typingRefreshRef.current);
      typingRefreshRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendTypingStop(conversationId);
    }
  }, [conversationId]);

  // Clean up typing state and timers when conversationId changes or on unmount
  useEffect(() => {
    return () => {
      stopTyping();
    };
  }, [conversationId, stopTyping]);

  // Auto-resize textarea height up to a max
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        140
      )}px`;
    }
  }, [draft]);

  function handleInputChange(e) {
    const value = e.target.value;
    setDraft(value);

    if (!value.trim()) {
      stopTyping();
      return;
    }

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTypingStart(conversationId);

      typingRefreshRef.current = setInterval(() => {
        sendTypingStart(conversationId);
      }, TYPING_REFRESH_INTERVAL);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, TYPING_STOP_DELAY);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSend() {
    const content = draft.trim();
    if (!content || sending) return;

    stopTyping();

    const clientMessageId = crypto.randomUUID();
    onSendMessage({ clientMessageId, content });
    setDraft("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  return {
    draft,
    textareaRef,
    handleInputChange,
    handleKeyDown,
    handleSend,
  };
}
