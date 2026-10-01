import ConversationListItem from "./ConversationListItem";
import Spinner from "../common/Spinner";
import { ChatIcon } from "../common/Icons";

export default function ConversationList({
  conversations = [],
  selectedId,
  onSelectConversation,
  loading,
  error,
  onNewChatClick,
}) {
  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
        <Spinner size="md" />
        <span className="text-xs">Loading conversations...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
        <p className="font-semibold mb-1">Failed to load conversations</p>
        <p>{error}</p>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mb-3">
          <ChatIcon className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium text-slate-200 mb-1">No conversations yet</p>
        <p className="text-xs text-slate-400 mb-4 max-w-xs">
          Search for registered users and start your first direct conversation.
        </p>
        <button
          type="button"
          onClick={onNewChatClick}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
        >
          Find People
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1 pr-1">
      {conversations.map((conv) => (
        <ConversationListItem
          key={conv.id}
          conversation={conv}
          isSelected={selectedId === conv.id}
          onSelect={onSelectConversation}
        />
      ))}
    </div>
  );
}
