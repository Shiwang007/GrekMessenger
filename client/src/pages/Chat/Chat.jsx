import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../socket/SocketProvider";
import { usePresence } from "../../context/PresenceContext";
import {
  createDirectConversation,
  getConversations,
  getConversation,
  createGroup,
} from "../../services/conversationApi";
import {
  sendConversationRead,
  sendMessageEdit,
  sendMessageDelete,
  sendReactionAdd,
  sendReactionRemove,
} from "../../socket/conversationSocket";
import { useChatMessages } from "../../hooks/useChatMessages";
import { useChatSocket } from "../../hooks/useChatSocket";

import AppHeader from "../../components/chat/AppHeader";
import ChatHeader from "../../components/chat/ChatHeader";
import EditMessageBar from "../../components/chat/EditMessageBar";
import TypingBanner from "../../components/chat/TypingBanner";
import Sidebar from "../../components/conversations/Sidebar";
import MessageList from "../../components/messages/MessageList";
import MessageComposer from "../../components/messages/MessageComposer";
import CreateGroupModal from "../../components/groups/CreateGroupModal";
import GroupInfo from "../../components/groups/GroupInfo";
import Spinner from "../../components/common/Spinner";
import { ChatIcon, CloseIcon } from "../../components/common/Icons";
import { getErrorMessage } from "../../utils/error";

export default function Chat() {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const { user, logout } = useAuth();
  const { isConnected, registerSubscription } = useSocket();
  const { setPresenceSnapshot, getPresence } = usePresence();

  // Conversations State
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [conversationsError, setConversationsError] = useState("");
  const [unreadCounts, setUnreadCounts] = useState(new Map());

  // Active Chat State
  const [activeTab, setActiveTab] = useState("chats"); // "chats" | "search"
  const [activeConversation, setActiveConversation] = useState(null);
  const [loadingActiveChat, setLoadingActiveChat] = useState(false);
  const [chatError, setChatError] = useState("");

  // Modals & Action States
  const [startingChat, setStartingChat] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [createGroupLoading, setCreateGroupLoading] = useState(false);
  const [createGroupError, setCreateGroupError] = useState("");
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingContent, setEditingContent] = useState("");
  const [actionError, setActionError] = useState("");

  async function handleCreateGroup({ name, avatarUrl }) {
    try {
      setCreateGroupLoading(true);
      setCreateGroupError("");
      const result = await createGroup({ name, avatarUrl });
      setConversations((prev) => [result.conversation, ...prev]);
      setIsCreateGroupOpen(false);
      navigate(`/chat/${result.conversation.id}`);
    } catch (err) {
      setCreateGroupError(getErrorMessage(err, "Failed to create group."));
    } finally {
      setCreateGroupLoading(false);
    }
  }

  const lastSentReadIdRef = useRef(new Map());
  const isFetchingConversationsRef = useRef(false);

  // 1. Message History & Optimistic Transport Hook
  const {
    messages,
    setMessages,
    hasMoreMessages,
    loadingMessages,
    loadingOlderMessages,
    loadOlderMessages,
    sendMessageOptimistic,
    retryMessage,
  } = useChatMessages({
    conversationId,
    isConnected,
    user,
  });

  // Fetch conversation list
  const fetchConversations = useCallback(async () => {
    if (isFetchingConversationsRef.current) return;
    isFetchingConversationsRef.current = true;

    try {
      setLoadingConversations(true);
      setConversationsError("");
      const result = await getConversations();
      const convs = result.conversations || [];
      setConversations(convs);

      // Seed unread counts
      const counts = new Map();
      for (const c of convs) {
        if (c.unreadCount != null) counts.set(c.id, c.unreadCount);
      }
      setUnreadCounts(counts);

      // Seed presence for direct conversation peers
      const directPeers = convs
        .filter((c) => c.type === "DIRECT" && c.otherUser)
        .map((c) => c.otherUser);
      setPresenceSnapshot(directPeers);
    } catch (err) {
      setConversationsError(getErrorMessage(err, "Failed to load chats."));
    } finally {
      setLoadingConversations(false);
      isFetchingConversationsRef.current = false;
    }
  }, [setPresenceSnapshot]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Synchronize active conversation on reconnect or load
  const syncActiveConversation = useCallback(async () => {
    if (!conversationId) return;
    try {
      const result = await getConversation(conversationId);
      setActiveConversation(result.conversation);
      if (result.conversation.type === "DIRECT" && result.conversation.otherUser) {
        setPresenceSnapshot([result.conversation.otherUser]);
      } else if (result.conversation.type === "GROUP" && result.conversation.members) {
        setPresenceSnapshot(result.conversation.members);
      }
    } catch (err) {
      console.error("Failed to sync active conversation:", err);
    }
  }, [conversationId, setPresenceSnapshot]);

  // Fetch active conversation details on URL change
  useEffect(() => {
    if (!conversationId) {
      setActiveConversation(null);
      setChatError("");
      setIsGroupInfoOpen(false);
      setEditingMessageId(null);
      setEditingContent("");
      return;
    }

    let isCancelled = false;

    async function loadActive() {
      try {
        setLoadingActiveChat(true);
        setChatError("");
        setEditingMessageId(null);
        setEditingContent("");

        const result = await getConversation(conversationId);
        if (isCancelled) return;

        setActiveConversation(result.conversation);
        if (result.conversation.type === "DIRECT" && result.conversation.otherUser) {
          setPresenceSnapshot([result.conversation.otherUser]);
        } else if (result.conversation.type === "GROUP" && result.conversation.members) {
          setPresenceSnapshot(result.conversation.members);
        }
      } catch (err) {
        if (!isCancelled) {
          setChatError(
            err.response?.status === 404
              ? "Conversation not found or access denied."
              : "Unable to load conversation."
          );
          setActiveConversation(null);
        }
      } finally {
        if (!isCancelled) {
          setLoadingActiveChat(false);
        }
      }
    }

    loadActive();

    return () => {
      isCancelled = true;
    };
  }, [conversationId, setPresenceSnapshot]);

  // 2. Real-Time Socket Events Hook
  const { typingUserIds } = useChatSocket({
    conversationId,
    currentUserId: user?.id,
    setMessages,
    setConversations,
    setUnreadCounts,
    registerSubscription,
    syncActiveConversation,
    onReconnect: fetchConversations,
  });

  // Read receipts tracking when messages enter viewport
  const handleMessageVisible = useCallback(
    (messageId) => {
      if (!conversationId || !messageId) return;

      const lastSent = lastSentReadIdRef.current.get(conversationId);
      if (lastSent) {
        const lastIdx = messages.findIndex((m) => m.id === lastSent);
        const newIdx = messages.findIndex((m) => m.id === messageId);
        if (newIdx >= 0 && lastIdx >= 0 && newIdx <= lastIdx) return;
      }

      lastSentReadIdRef.current.set(conversationId, messageId);

      sendConversationRead(conversationId, messageId, (response) => {
        if (response?.ok) {
          setUnreadCounts((current) => {
            const next = new Map(current);
            next.set(conversationId, response.unreadCount);
            return next;
          });
        }
      });
    },
    [conversationId, messages]
  );

  // Bump conversation in sidebar when user sends a message
  const handleConversationBump = useCallback(
    (canonicalMessage) => {
      setConversations((prev) => {
        const target = prev.find((c) => c.id === conversationId);
        if (!target) return prev;
        const updated = {
          ...target,
          updatedAt: canonicalMessage.createdAt,
          lastMessage: { content: canonicalMessage.content, senderId: canonicalMessage.senderId },
        };
        return [updated, ...prev.filter((c) => c.id !== conversationId)];
      });
    },
    [conversationId]
  );

  // Message Send Handler with immediate optimistic conversation bumping
  const handleSendMessage = useCallback(
    ({ clientMessageId, content }) => {
      const nowIso = new Date().toISOString();

      // Immediately bump conversation to top for sender
      setConversations((prev) => {
        const target = prev.find((c) => c.id === conversationId);
        if (!target) return prev;
        const updated = {
          ...target,
          updatedAt: nowIso,
          lastMessage: { content, senderId: user?.id },
        };
        return [updated, ...prev.filter((c) => c.id !== conversationId)];
      });

      sendMessageOptimistic(
        { clientMessageId, content },
        (canonicalMessage) => {
          setConversations((prev) => {
            const targetId = canonicalMessage?.conversationId || conversationId;
            const target = prev.find((c) => c.id === targetId);
            if (!target) return prev;
            const updated = {
              ...target,
              updatedAt: canonicalMessage.createdAt || nowIso,
              lastMessage: {
                content: canonicalMessage.content,
                senderId: canonicalMessage.senderId,
              },
            };
            return [updated, ...prev.filter((c) => c.id !== targetId)];
          });
        }
      );
    },
    [conversationId, sendMessageOptimistic, user]
  );

  // Message Retry Handler
  const handleRetryMessage = useCallback(
    (failedMessage) => {
      retryMessage(failedMessage, handleConversationBump);
    },
    [retryMessage, handleConversationBump]
  );

  // Edit Message Handlers
  function handleEditMessage(message) {
    setEditingMessageId(message.id);
    setEditingContent(message.content || "");
  }

  function handleCancelEdit() {
    setEditingMessageId(null);
    setEditingContent("");
  }

  function handleSaveEdit() {
    const content = editingContent.trim();
    if (!content || !editingMessageId || !conversationId) return;

    sendMessageEdit(
      { conversationId, messageId: editingMessageId, content },
      (response) => {
        if (response?.ok) {
          setEditingMessageId(null);
          setEditingContent("");
          setActionError("");
        } else {
          const msg = response?.error?.message || "Edit failed.";
          console.error("Edit failed:", msg);
          setActionError(msg);
        }
      }
    );
  }

  // Delete Message Handler
  function handleDeleteMessage(message) {
    if (!message?.id || !conversationId) return;

    sendMessageDelete(
      { conversationId, messageId: message.id },
      (response) => {
        if (!response?.ok) {
          const msg = response?.error?.message || "Delete failed.";
          console.error("Delete failed:", msg);
          setActionError(msg);
        } else {
          setActionError("");
        }
      }
    );
  }

  // Reaction Toggle Handler
  function handleReactionToggle(message, emoji) {
    if (!message?.id || !emoji || !conversationId) return;

    const reaction = message.reactions?.find((r) => r.emoji === emoji);
    const hasReacted = reaction?.userIds?.includes(user?.id);

    if (hasReacted) {
      sendReactionRemove({ conversationId, messageId: message.id, emoji });
    } else {
      sendReactionAdd({ conversationId, messageId: message.id, emoji });
    }
  }

  // Start new Direct Chat from user search
  async function handleStartChat(targetUser) {
    if (startingChat) return;
    try {
      setStartingChat(true);
      const result = await createDirectConversation(targetUser.id);
      const conv = result.conversation;

      setConversations((prev) => {
        const exists = prev.some((c) => c.id === conv.id);
        return exists ? prev : [conv, ...prev];
      });

      setActiveTab("chats");
      navigate(`/chat/${conv.id}`);
    } catch (err) {
      console.error("Failed to create direct conversation:", err);
    } finally {
      setStartingChat(false);
    }
  }

  // Derived Header Props
  const isGroup = activeConversation?.type === "GROUP";
  const isDirect = activeConversation?.type === "DIRECT";
  const otherUser = activeConversation?.otherUser;
  const chatTitle = isGroup
    ? activeConversation?.name || "Group Chat"
    : otherUser?.name || "Direct Message";
  const activeAvatarUrl = isGroup
    ? activeConversation?.avatarUrl
    : otherUser?.avatar_url;

  const currentMember = isGroup
    ? activeConversation?.members?.find((m) => (m.userId || m.id) === user?.id)
    : null;
  const currentUserRole = currentMember?.role || "MEMBER";

  const partnerId = otherUser?.id || otherUser?.userId;
  const partnerPresence = isDirect && partnerId ? getPresence(partnerId) : null;
  const activePartnerPresence = {
    online: partnerPresence?.online ?? otherUser?.online ?? false,
    lastSeenAt: partnerPresence?.lastSeenAt ?? otherUser?.last_seen_at ?? null,
  };
  const isPartnerTyping = isDirect && partnerId && typingUserIds.has(partnerId);

  // Compute typing banner text
  const typingText = (() => {
    if (isDirect) {
      return isPartnerTyping ? `${otherUser?.name || "User"} is typing...` : null;
    }
    if (!isGroup || typingUserIds.size === 0) return null;

    const typers = [];
    for (const uid of typingUserIds) {
      const member = activeConversation?.members?.find((m) => (m.userId || m.id) === uid);
      if (member?.name) typers.push(member.name);
    }

    if (typers.length === 0) return null;
    if (typers.length === 1) return `${typers[0]} is typing...`;
    if (typers.length === 2) return `${typers[0]} and ${typers[1]} are typing...`;
    return `${typers[0]}, ${typers[1]} and ${typers.length - 2} others are typing...`;
  })();

  return (
    <div className="fixed inset-0 h-full w-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      {/* Top Application Header: visible on desktop always, on mobile only when no conversation is selected */}
      <div className={`w-full flex-shrink-0 z-30 ${conversationId ? "hidden md:block" : "block"}`}>
        <AppHeader user={user} onLogout={logout} />
      </div>

      {/* Main Container: Sidebar + Chat Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 relative">
        <Sidebar
          conversationId={conversationId}
          conversations={conversations}
          loadingConversations={loadingConversations}
          conversationsError={conversationsError}
          unreadCounts={unreadCounts}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onSelectConversation={(conv) => navigate(`/chat/${conv.id}`)}
          onStartChat={handleStartChat}
          startingChat={startingChat}
          onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
        />

        {/* Right Area: Active Conversation / Empty State */}
        <main
          className={`flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-slate-950 relative ${
            conversationId ? "flex" : "hidden md:flex"
          }`}
        >
          {loadingActiveChat ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3">
              <Spinner size="lg" />
              <p className="text-xs text-slate-400">Loading conversation...</p>
            </div>
          ) : chatError ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-white mb-1">Conversation Error</h3>
              <p className="text-sm text-slate-400 mb-4">{chatError}</p>
              <button
                type="button"
                onClick={() => navigate("/chat")}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all"
              >
                Back to Chats
              </button>
            </div>
          ) : activeConversation ? (
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
              {/* Header */}
              <ChatHeader
                activeConversation={activeConversation}
                isGroup={isGroup}
                isDirect={isDirect}
                chatTitle={chatTitle}
                activeAvatarUrl={activeAvatarUrl}
                currentUserRole={currentUserRole}
                activePartnerPresence={activePartnerPresence}
                isPartnerTyping={isPartnerTyping}
                onBack={() => navigate("/chat")}
                onOpenGroupInfo={() => setIsGroupInfoOpen(true)}
              />

              {/* Message History & Chat Body */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-950/20">
                <MessageList
                  messages={messages}
                  currentUserId={user?.id}
                  isGroup={isGroup}
                  loading={loadingMessages}
                  loadingOlder={loadingOlderMessages}
                  hasMore={hasMoreMessages}
                  onLoadOlder={loadOlderMessages}
                  onRetryMessage={handleRetryMessage}
                  onMessageVisible={handleMessageVisible}
                  onEdit={handleEditMessage}
                  onDelete={handleDeleteMessage}
                  onReactionToggle={handleReactionToggle}
                />

                {/* Ephemeral Typing Indicator Banner */}
                <TypingBanner typingText={typingText} />

                {/* Action Error Banner */}
                {actionError && (
                  <div className="px-4 py-2 bg-red-950/90 border-t border-red-500/30 text-xs text-red-300 flex items-center justify-between animate-fade-in flex-shrink-0">
                    <span className="flex items-center space-x-1.5">
                      <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{actionError}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActionError("")}
                      className="text-red-400 hover:text-white p-0.5 ml-2 transition-colors"
                      title="Dismiss"
                    >
                      <CloseIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Edit Mode Bar OR Message Composer */}
                {editingMessageId ? (
                  <EditMessageBar
                    editingContent={editingContent}
                    setEditingContent={setEditingContent}
                    onSave={handleSaveEdit}
                    onCancel={handleCancelEdit}
                  />
                ) : (
                  <MessageComposer
                    conversationId={conversationId}
                    onSendMessage={handleSendMessage}
                    disabled={Boolean(chatError)}
                  />
                )}
              </div>
            </div>
          ) : (
            /* Empty State: No Conversation Selected */
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
              <div className="w-16 h-16 rounded-3xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4 shadow-inner">
                <ChatIcon className="w-8 h-8" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-bold text-white mb-1.5">Select a conversation</h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-sm mb-6">
                Choose an existing chat from the left or search for other users to start a new real-time conversation.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("search")}
                className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold rounded-xl transition-all flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>Find users to message</span>
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Modals & Drawers */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => {
          setIsCreateGroupOpen(false);
          setCreateGroupError("");
        }}
        onSubmit={handleCreateGroup}
        loading={createGroupLoading}
        error={createGroupError}
      />

      <GroupInfo
        conversation={activeConversation}
        isOpen={isGroupInfoOpen}
        onClose={() => setIsGroupInfoOpen(false)}
        currentUserId={user?.id}
        onGroupUpdated={(updated) => {
          setActiveConversation((prev) => ({ ...prev, ...updated }));
          setConversations((prev) =>
            prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
          );
        }}
        onGroupDeleted={(deletedId) => {
          setIsGroupInfoOpen(false);
          setActiveConversation(null);
          setConversations((prev) => prev.filter((c) => c.id !== (deletedId || conversationId)));
          navigate("/chat");
        }}
      />
    </div>
  );
}
