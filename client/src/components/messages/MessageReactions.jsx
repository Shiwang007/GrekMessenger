export default function MessageReactions({
  reactions = [],
  currentUserId,
  isMine = false,
  isDeleted = false,
  onReactionToggle,
  message,
}) {
  if (reactions.length === 0 || isDeleted) return null;

  return (
    <div
      className={`flex flex-wrap gap-1 mt-1 ${
        isMine ? "justify-end" : "justify-start"
      }`}
    >
      {reactions.map((r) => {
        const hasReacted = r.userIds?.includes(currentUserId);
        return (
          <button
            key={r.emoji}
            type="button"
            onClick={() => onReactionToggle?.(message, r.emoji)}
            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs border transition-all ${
              hasReacted
                ? "bg-indigo-500/25 border-indigo-400/50 text-indigo-200 shadow-sm"
                : "bg-slate-800/60 border-white/10 text-slate-300 hover:border-white/20 hover:bg-slate-700/60"
            }`}
            title={`${r.emoji} ${r.count} ${hasReacted ? "(Click to remove)" : "(Click to react)"}`}
          >
            <span>{r.emoji}</span>
            <span className="font-medium text-[11px]">{r.count}</span>
          </button>
        );
      })}
    </div>
  );
}
