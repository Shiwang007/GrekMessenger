import { useState, useRef, useEffect } from "react";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

export default function MessageActions({
  message,
  isMine,
  canEdit,
  isEditable,
  canDelete,
  isDeletable,
  canReact,
  onEdit,
  onDelete,
  onReactionToggle,
}) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const popoverRef = useRef(null);

  // Close reaction picker & delete confirm when clicking outside
  useEffect(() => {
    if (!showReactionPicker && !showDeleteConfirm) return;
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setShowReactionPicker(false);
        setShowDeleteConfirm(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showReactionPicker, showDeleteConfirm]);

  const isMenuOpen = showReactionPicker || showDeleteConfirm;

  // Actions for own messages (left of bubble)
  if (isMine) {
    return (
      <div
        ref={popoverRef}
        className={`flex items-center space-x-1 mb-1.5 flex-shrink-0 transition-opacity duration-150 ${
          isMenuOpen
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
        }`}
      >
        {/* Reaction Picker Button & Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowReactionPicker((prev) => !prev);
              setShowDeleteConfirm(false);
            }}
            className="p-1 rounded-md text-slate-400 hover:text-amber-400 hover:bg-slate-800/80 transition-colors"
            title="Add reaction"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {showReactionPicker && (
            <div className="absolute bottom-full right-0 mb-2 bg-slate-800 border border-white/15 rounded-xl shadow-2xl z-50 p-1 flex items-center space-x-0.5 animate-fade-in">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setShowReactionPicker(false);
                    onReactionToggle?.(message, emoji);
                  }}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-base transition-transform hover:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Edit Message Button */}
        {canEdit && (
          isEditable ? (
            <button
              type="button"
              onClick={() => {
                setShowReactionPicker(false);
                setShowDeleteConfirm(false);
                onEdit?.(message);
              }}
              className="p-1 rounded-md text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 transition-colors"
              title="Edit message"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="p-1 rounded-md text-slate-600 cursor-not-allowed opacity-50"
              title="Cannot edit: 10-minute edit window has expired"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )
        )}

        {/* Delete Message Button & Confirmation Popover */}
        {canDelete && (
          <div className="relative">
            {isDeletable ? (
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm((prev) => !prev);
                  setShowReactionPicker(false);
                }}
                className="p-1 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-800/80 transition-colors"
                title="Delete message for everyone"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="p-1 rounded-md text-slate-600 cursor-not-allowed opacity-50"
                title="Cannot delete: 10-minute deletion window has expired"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}

            {/* Confirmation Popover */}
            {showDeleteConfirm && (
              <div className="absolute bottom-full right-0 mb-2 bg-slate-900 border border-red-500/30 rounded-xl shadow-2xl z-50 p-2.5 min-w-[210px] text-xs animate-fade-in">
                <p className="text-slate-200 font-medium mb-2">Delete message for everyone?</p>
                <div className="flex justify-end space-x-1.5">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-2.5 py-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      onDelete?.(message);
                    }}
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-medium rounded-md transition-colors shadow-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Actions for others' messages (right of bubble — only reaction)
  if (!isMine && canReact) {
    return (
      <div
        ref={popoverRef}
        className={`flex items-center mb-1.5 flex-shrink-0 transition-opacity duration-150 ${
          showReactionPicker
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
        }`}
      >
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowReactionPicker((prev) => !prev)}
            className="p-1 rounded-md text-slate-400 hover:text-amber-400 hover:bg-slate-800/80 transition-colors"
            title="Add reaction"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {showReactionPicker && (
            <div className="absolute bottom-full left-0 mb-2 bg-slate-800 border border-white/15 rounded-xl shadow-2xl z-50 p-1 flex items-center space-x-0.5 animate-fade-in">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setShowReactionPicker(false);
                    onReactionToggle?.(message, emoji);
                  }}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-base transition-transform hover:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
