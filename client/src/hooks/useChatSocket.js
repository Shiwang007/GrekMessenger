import { useEffect, useState } from "react";
import { socket } from "../socket/socket";
import { joinConversation, leaveConversation, sendDeliveryReceipt } from "../socket/conversationSocket";
import { mergeMessages } from "./useChatMessages";

export function useChatSocket({
  conversationId,
  currentUserId,
  setMessages,
  setConversations,
  setUnreadCounts,
  registerSubscription,
  syncActiveConversation,
  onReconnect,
}) {
  const [typingUserIds, setTypingUserIds] = useState(new Set());

  // Refetch conversations only on genuine socket reconnections (not initial connection)
  useEffect(() => {
    const hasConnectedRef = { current: socket.connected };

    function handleReconnect() {
      if (hasConnectedRef.current) {
        onReconnect?.();
      }
      hasConnectedRef.current = true;
    }

    socket.on("connect", handleReconnect);
    return () => {
      socket.off("connect", handleReconnect);
    };
  }, [onReconnect]);

  // Join/leave conversation socket rooms and register subscription with SocketProvider
  useEffect(() => {
    if (!conversationId) return;

    function doJoin() {
      if (socket.connected) {
        joinConversation(conversationId).catch(() => {});
      }
    }

    doJoin();
    socket.on("connect", doJoin);

    const unregister = registerSubscription?.(conversationId, async () => {
      doJoin();
      syncActiveConversation?.();
    });

    return () => {
      socket.off("connect", doJoin);
      if (socket.connected) {
        leaveConversation(conversationId).catch(() => {});
      }
      unregister?.();
    };
  }, [conversationId, registerSubscription, syncActiveConversation]);

  // Handle incoming new messages
  useEffect(() => {
    function handleNewMessage(message) {
      if (!message) return;

      // Real-time update for conversation sidebar: bump to top with latest timestamp
      setConversations?.((prev) => {
        const target = prev.find((c) => c.id === message.conversationId);
        if (!target) {
          // If message arrives for a conversation not yet in sidebar, refresh conversation list
          onReconnect?.();
          return prev;
        }
        const updated = {
          ...target,
          updatedAt: message.createdAt,
          lastMessage: { content: message.content, senderId: message.senderId },
        };
        return [updated, ...prev.filter((c) => c.id !== message.conversationId)];
      });

      // If incoming message belongs to currently open conversation, merge it
      if (message.conversationId === conversationId) {
        setMessages?.((current) => mergeMessages(current, [message]));
      }

      // Emit delivery receipt for incoming messages from other users
      if (message.senderId !== currentUserId && message.id && !message.id.startsWith("temp")) {
        sendDeliveryReceipt(message.id);
      }
    }

    socket.on("message:new", handleNewMessage);
    return () => {
      socket.off("message:new", handleNewMessage);
    };
  }, [conversationId, currentUserId, onReconnect, setConversations, setMessages]);

  // Handle real-time conversation lifecycle events (new chat started, added to group, member updates)
  useEffect(() => {
    function handleConversationCreated(newConv) {
      if (!newConv?.id) return;
      setConversations?.((prev) => {
        const exists = prev.some((c) => c.id === newConv.id);
        if (exists) return prev;
        return [newConv, ...prev];
      });
    }

    function handleConversationRemoved({ conversationId: removedId }) {
      if (!removedId) return;
      setConversations?.((prev) => prev.filter((c) => c.id !== removedId));
    }

    function handleGroupMemberAdded({ conversationId: targetId }) {
      if (targetId === conversationId) {
        syncActiveConversation?.();
      }
    }

    function handleGroupMemberRemoved({ conversationId: targetId }) {
      if (targetId === conversationId) {
        syncActiveConversation?.();
      }
    }

    function handleGroupUpdated({ conversationId: targetId, conversation: updatedConv }) {
      if (targetId === conversationId) {
        syncActiveConversation?.();
      }
      setConversations?.((prev) =>
        prev.map((c) => (c.id === targetId ? { ...c, ...updatedConv } : c))
      );
    }

    socket.on("conversation:created", handleConversationCreated);
    socket.on("conversation:removed", handleConversationRemoved);
    socket.on("group:member_added", handleGroupMemberAdded);
    socket.on("group:member_removed", handleGroupMemberRemoved);
    socket.on("group:updated", handleGroupUpdated);

    return () => {
      socket.off("conversation:created", handleConversationCreated);
      socket.off("conversation:removed", handleConversationRemoved);
      socket.off("group:member_added", handleGroupMemberAdded);
      socket.off("group:member_removed", handleGroupMemberRemoved);
      socket.off("group:updated", handleGroupUpdated);
    };
  }, [conversationId, setConversations, syncActiveConversation]);

  // Handle unread count updates
  useEffect(() => {
    function handleUnreadUpdate(update) {
      if (!update?.conversationId) return;
      setUnreadCounts?.((current) => {
        const next = new Map(current);
        next.set(update.conversationId, update.unreadCount);
        return next;
      });
    }

    socket.on("unread:update", handleUnreadUpdate);
    return () => {
      socket.off("unread:update", handleUnreadUpdate);
    };
  }, [setUnreadCounts]);

  // Handle delivery and read receipts
  useEffect(() => {
    function handleReceipt(receipt) {
      if (!receipt?.messageId) return;
      setMessages?.((current) =>
        current.map((msg) =>
          msg.id === receipt.messageId
            ? {
                ...msg,
                deliveredAt: receipt.deliveredAt ?? msg.deliveredAt,
                readAt: receipt.readAt ?? msg.readAt,
                seenCount: receipt.seenCount ?? msg.seenCount,
                recipientCount: receipt.recipientCount ?? msg.recipientCount,
              }
            : msg
        )
      );
    }

    socket.on("message:receipt", handleReceipt);
    return () => {
      socket.off("message:receipt", handleReceipt);
    };
  }, [setMessages]);

  // Handle message edits
  useEffect(() => {
    function handleEdited({ message: editedMsg }) {
      if (!editedMsg?.id) return;
      setMessages?.((current) =>
        current.map((m) => (m.id === editedMsg.id ? { ...m, ...editedMsg } : m))
      );
    }

    socket.on("message:edited", handleEdited);
    return () => {
      socket.off("message:edited", handleEdited);
    };
  }, [setMessages]);

  // Handle message deletions
  useEffect(() => {
    function handleDeleted({ messageId, deletedAt }) {
      if (!messageId) return;
      setMessages?.((current) =>
        current.map((m) =>
          m.id === messageId
            ? { ...m, content: null, deletedAt, reactions: [] }
            : m
        )
      );
    }

    socket.on("message:deleted", handleDeleted);
    return () => {
      socket.off("message:deleted", handleDeleted);
    };
  }, [setMessages]);

  // Handle reaction updates
  useEffect(() => {
    function handleReactionUpdated(event) {
      if (!event?.messageId) return;
      setMessages?.((current) =>
        current.map((msg) => {
          if (msg.id !== event.messageId) return msg;

          const reactions = [...(msg.reactions || [])];
          let reaction = reactions.find((r) => r.emoji === event.emoji);

          if (event.action === "added") {
            if (!reaction) {
              reaction = { emoji: event.emoji, count: 0, userIds: [] };
              reactions.push(reaction);
            }
            if (!reaction.userIds.includes(event.userId)) {
              reaction.userIds = [...reaction.userIds, event.userId];
              reaction.count = reaction.userIds.length;
            }
          } else if (event.action === "removed" && reaction) {
            reaction.userIds = reaction.userIds.filter((id) => id !== event.userId);
            reaction.count = reaction.userIds.length;
          }

          return {
            ...msg,
            reactions: reactions.filter((r) => r.count > 0),
          };
        })
      );
    }

    socket.on("reaction:updated", handleReactionUpdated);
    return () => {
      socket.off("reaction:updated", handleReactionUpdated);
    };
  }, [setMessages]);

  // Handle typing updates
  useEffect(() => {
    setTypingUserIds(new Set());
    if (!conversationId) return;

    function handleTypingUpdate(update) {
      if (update?.conversationId !== conversationId) return;
      if (update.userId === currentUserId) return;

      setTypingUserIds((prev) => {
        const next = new Set(prev);
        if (update.typing) {
          next.add(update.userId);
        } else {
          next.delete(update.userId);
        }
        return next;
      });
    }

    socket.on("typing:update", handleTypingUpdate);
    return () => {
      socket.off("typing:update", handleTypingUpdate);
    };
  }, [conversationId, currentUserId]);

  return { typingUserIds };
}
