import Avatar from "../common/Avatar";
import { usePresence } from "../../context/PresenceContext";

export default function ConversationListItem({
  conversation,
  isSelected,
  onSelect,
}) {
  const isDirect = conversation.type === "DIRECT";
  const presence = usePresence(isDirect ? conversation.otherUser?.id : null);
  const title = isDirect
    ? conversation.otherUser?.name || "Direct Chat"
    : conversation.name || "Group Chat";

  const subtitle = conversation.lastMessage?.content
    ? conversation.lastMessage.content
    : isDirect
    ? conversation.otherUser?.email
    : conversation.currentUserRole
    ? `Group · Role: ${conversation.currentUserRole}`
    : "Group conversation";

  const avatarUrl = isDirect
    ? conversation.otherUser?.avatarUrl
    : conversation.avatarUrl;

  const timeString = conversation.updatedAt
    ? new Date(conversation.updatedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const unreadCount = conversation.unreadCount || 0;

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation)}
      className={`w-full flex items-center space-x-3.5 p-3 rounded-xl text-left transition-all duration-150 border ${
        isSelected
          ? "bg-indigo-600/20 border-indigo-500/40 shadow-sm"
          : "hover:bg-white/5 active:bg-white/10 border-transparent hover:border-white/5"
      }`}
    >
      <div className="relative flex-shrink-0">
        <Avatar
          src={avatarUrl}
          alt={title}
          type={conversation.type}
          size="lg"
        />
        {isDirect && presence.online && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full shadow-sm"
            title="Online"
          ></span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <h3
            className={`text-sm font-semibold truncate ${
              unreadCount > 0 ? "text-white font-bold" :
              isSelected ? "text-indigo-200" : "text-slate-100"
            }`}
          >
            {title}
          </h3>
          <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
            {timeString && (
              <span className={`text-[11px] font-mono ${unreadCount > 0 ? "text-indigo-400" : "text-slate-400"}`}>
                {timeString}
              </span>
            )}
            {unreadCount > 0 && (
              <span className="min-w-[20px] h-5 flex items-center justify-center px-1.5 text-[10px] font-bold text-white bg-indigo-600 rounded-full shadow-sm shadow-indigo-600/40">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
        </div>
        <p className={`text-xs truncate ${unreadCount > 0 ? "text-slate-200 font-medium" : "text-slate-400"}`}>{subtitle}</p>
      </div>
    </button>
  );
}

