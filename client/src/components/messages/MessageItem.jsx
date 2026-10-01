import Avatar from "../common/Avatar";
import ReceiptIcon, { getReceiptStatus } from "../common/ReceiptIcon";
import MessageActions from "./MessageActions";
import MessageReactions from "./MessageReactions";

function isWithinTenMinutes(createdAt) {
  if (!createdAt) return false;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return ageMs <= 10 * 60 * 1000;
}

export default function MessageItem({
  message,
  currentUserId,
  isGroup = false,
  onRetry,
  onEdit,
  onDelete,
  onReactionToggle,
  innerRef,
}) {
  const isMine = message.senderId === currentUserId;
  const isFailed = message.status === "failed";
  const isSending = message.status === "sending";
  const isDeleted = !!message.deletedAt;
  const isEdited =
    !isDeleted &&
    message.updatedAt &&
    message.createdAt &&
    message.updatedAt !== message.createdAt;

  const formattedTime = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const receiptStatus =
    isMine && !isSending && !isFailed && !isDeleted
      ? getReceiptStatus(message)
      : null;

  const seenText =
    isMine && isGroup && message.seenCount > 0 && message.recipientCount > 0
      ? `Seen by ${message.seenCount} of ${message.recipientCount}`
      : null;

  const canEdit = isMine && !isDeleted && !isSending && !isFailed;
  const isEditable = canEdit && isWithinTenMinutes(message.createdAt);
  const canDelete = isMine && !isDeleted && !isSending && !isFailed;
  const isDeletable = canDelete && isWithinTenMinutes(message.createdAt);
  const canReact = !isDeleted && !isSending && !isFailed;

  return (
    <div
      ref={innerRef}
      data-message-id={message.id}
      data-sender-id={message.senderId}
      data-created-at={message.createdAt}
      className={`group flex items-end space-x-2 my-2.5 px-2 ${
        isMine ? "justify-end" : "justify-start"
      }`}
    >
      {/* Sender Avatar for incoming group messages */}
      {!isMine && isGroup && (
        <div className="flex-shrink-0 mb-1">
          <Avatar
            src={message.sender?.avatarUrl}
            alt={message.sender?.name || "User"}
            type="DIRECT"
            size="sm"
          />
        </div>
      )}

      {/* Action buttons bar for own messages (left of bubble) */}
      {isMine && !isDeleted && !isSending && !isFailed && (
        <MessageActions
          message={message}
          isMine={true}
          canEdit={canEdit}
          isEditable={isEditable}
          canDelete={canDelete}
          isDeletable={isDeletable}
          canReact={canReact}
          onEdit={onEdit}
          onDelete={onDelete}
          onReactionToggle={onReactionToggle}
        />
      )}

      {/* Message Bubble Container */}
      <div
        className={`max-w-[78%] sm:max-w-[65%] flex flex-col ${
          isMine ? "items-end" : "items-start"
        }`}
      >
        {/* Sender name for incoming group messages */}
        {!isMine && isGroup && (
          <span className="text-[11px] font-semibold text-indigo-300 mb-1 ml-1 truncate">
            {message.sender?.name || "Member"}
          </span>
        )}

        {/* Message Bubble */}
        <div
          className={`relative px-4 py-2.5 text-sm transition-all duration-150 ${
            isDeleted
              ? "bg-slate-800/40 text-slate-400/80 rounded-2xl border border-white/5 italic"
              : isMine
              ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-2xl rounded-tr-xs shadow-md shadow-indigo-900/30"
              : "bg-slate-800/90 text-slate-100 rounded-2xl rounded-tl-xs border border-white/10 shadow-sm"
          } ${isFailed ? "border border-red-500/50 bg-red-950/30" : ""} ${
            isSending ? "opacity-75" : "opacity-100"
          }`}
        >
          {isDeleted ? (
            <p className="flex items-center space-x-1.5 text-slate-400 select-none">
              <svg className="w-3.5 h-3.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <span>This message was deleted</span>
            </p>
          ) : (
            <p className="whitespace-pre-wrap break-words leading-relaxed selection:bg-indigo-300 selection:text-slate-900">
              {message.content}
            </p>
          )}

          <div
            className={`flex items-center space-x-1.5 mt-1 text-[10px] ${
              isMine
                ? "justify-end text-indigo-200/80"
                : "justify-start text-slate-400"
            }`}
          >
            {isEdited && <span className="italic opacity-80">edited</span>}
            {formattedTime && <span>{formattedTime}</span>}
            {isSending && (
              <span className="italic flex items-center space-x-1 text-indigo-300">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-300 animate-ping"></span>
                <span>sending</span>
              </span>
            )}
            {isFailed && (
              <span className="text-red-400 font-semibold">Failed</span>
            )}
            {receiptStatus && <ReceiptIcon status={receiptStatus} />}
          </div>
        </div>

        {/* Reaction Display Pills */}
        <MessageReactions
          reactions={message.reactions}
          currentUserId={currentUserId}
          isMine={isMine}
          isDeleted={isDeleted}
          onReactionToggle={onReactionToggle}
          message={message}
        />

        {/* Group seen count */}
        {seenText && (
          <span className="text-[10px] text-slate-400 mt-0.5 mr-1">
            {seenText}
          </span>
        )}

        {/* Retry Button if failed */}
        {isFailed && onRetry && (
          <button
            type="button"
            onClick={() => onRetry(message)}
            className="mt-1 text-[11px] font-semibold text-red-400 hover:text-red-300 flex items-center space-x-1 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Retry sending</span>
          </button>
        )}
      </div>

      {/* Action buttons bar for others' messages (right of bubble) */}
      {!isMine && canReact && (
        <MessageActions
          message={message}
          isMine={false}
          canEdit={false}
          isEditable={false}
          canDelete={false}
          isDeletable={false}
          canReact={canReact}
          onReactionToggle={onReactionToggle}
        />
      )}
    </div>
  );
}
