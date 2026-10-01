import ConversationList from "./ConversationList";
import UserSearch from "../users/UserSearch";

export default function Sidebar({
  conversationId,
  conversations,
  loadingConversations,
  conversationsError,
  unreadCounts,
  activeTab,
  setActiveTab,
  onSelectConversation,
  onStartChat,
  startingChat,
  onOpenCreateGroup,
}) {
  return (
    <aside
      className={`w-full md:w-96 border-r border-white/10 bg-slate-900/50 p-4 flex flex-col h-full min-h-0 overflow-hidden ${
        conversationId ? "hidden md:flex" : "flex"
      }`}
    >
      {/* Quick Action: New Group Button */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Messaging
        </span>
        <button
          type="button"
          onClick={onOpenCreateGroup}
          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 px-2.5 py-1 rounded-lg transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          <span>New Group</span>
        </button>
      </div>

      {/* Tabs: Chats vs New Chat */}
      <div className="flex items-center p-1 bg-slate-800/80 rounded-xl mb-4 border border-white/5 flex-shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("chats")}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center space-x-2 ${
            activeTab === "chats"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>Conversations</span>
          {conversations.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white font-mono">
              {conversations.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("search")}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 ${
            activeTab === "search"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          <span>New Direct Chat</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === "chats" ? (
          <ConversationList
            conversations={conversations.map((c) => ({
              ...c,
              unreadCount: unreadCounts.get(c.id) ?? c.unreadCount ?? 0,
            }))}
            selectedId={conversationId}
            onSelectConversation={onSelectConversation}
            loading={loadingConversations}
            error={conversationsError}
          />
        ) : (
          <UserSearch
            onSelectUser={onStartChat}
            disabled={startingChat}
          />
        )}
      </div>
    </aside>
  );
}
