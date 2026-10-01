import Avatar from "../common/Avatar";
import RoleBadge from "../common/RoleBadge";
import { formatLastSeen } from "../../utils/presence";

export default function ChatHeader({
  activeConversation,
  isGroup,
  isDirect,
  chatTitle,
  activeAvatarUrl,
  currentUserRole,
  activePartnerPresence,
  isPartnerTyping,
  onBack,
  onOpenGroupInfo,
}) {
  return (
    <div className="h-16 border-b border-white/10 px-4 sm:px-6 flex items-center justify-between bg-slate-900/60 backdrop-blur-md flex-shrink-0">
      <div className="flex items-center space-x-2.5 sm:space-x-3.5 min-w-0">
        {/* Mobile Back Button */}
        <button
          type="button"
          onClick={onBack}
          className="md:hidden p-1.5 -ml-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors flex-shrink-0"
          title="Back to conversations"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="relative flex-shrink-0">
          <Avatar
            src={activeAvatarUrl}
            alt={chatTitle}
            type={activeConversation.type}
            size="md"
          />
          {isDirect && activePartnerPresence?.online && (
            <span
              className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full"
              title="Online"
            />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm sm:text-base font-bold text-white leading-tight truncate">
              {chatTitle}
            </h2>
            {isGroup && (
              <RoleBadge role={currentUserRole} className="hidden sm:inline-flex" />
            )}
          </div>
          <div className="text-xs text-slate-400 truncate flex items-center space-x-1.5 mt-0.5">
            {isDirect ? (
              isPartnerTyping ? (
                <span className="text-indigo-400 font-medium animate-pulse flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full inline-block animate-ping" />
                  <span>typing...</span>
                </span>
              ) : activePartnerPresence?.online ? (
                <span className="text-emerald-400 font-medium flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block animate-pulse" />
                  <span>Online</span>
                </span>
              ) : activePartnerPresence?.lastSeenAt ? (
                <span>Last seen {formatLastSeen(activePartnerPresence.lastSeenAt)}</span>
              ) : (
                <span>Offline</span>
              )
            ) : (
              <span>{activeConversation.members?.length || 0} members · Group Chat</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
        {isGroup && (
          <button
            type="button"
            onClick={onOpenGroupInfo}
            className="p-2 sm:px-3 sm:py-1.5 text-xs font-semibold text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all flex items-center space-x-1.5"
            title="Group Info"
          >
            <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="hidden sm:inline">Group Info</span>
          </button>
        )}

        <div className="text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full font-mono hidden sm:block">
          ID: {activeConversation.id.slice(0, 8)}...
        </div>
      </div>
    </div>
  );
}
