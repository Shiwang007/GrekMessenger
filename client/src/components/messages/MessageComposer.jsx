import { useMessageComposer } from "../../hooks/useMessageComposer";
import Spinner from "../common/Spinner";

export default function MessageComposer({ conversationId, onSendMessage, sending = false }) {
  const {
    draft,
    textareaRef,
    handleInputChange,
    handleKeyDown,
    handleSend,
  } = useMessageComposer({ conversationId, onSendMessage, sending });

  return (
    <div className="p-3 sm:p-4 bg-slate-900/80 border-t border-white/10 backdrop-blur-md flex-shrink-0">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-end space-x-2 sm:space-x-3 bg-slate-800/80 border border-white/10 rounded-2xl px-3 py-2 focus-within:border-indigo-500/60 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all shadow-inner"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={draft}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
          disabled={sending}
          maxLength={5000}
          className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-400 focus:outline-none resize-none max-h-36 py-1 leading-relaxed"
        />

        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="p-2 sm:px-4 sm:py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-xl transition-all shadow-md shadow-indigo-600/30 flex items-center justify-center space-x-1.5 flex-shrink-0"
          title="Send message"
        >
          {sending ? (
            <Spinner size="sm" color="white" />
          ) : (
            <>
              <svg className="w-4 h-4 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19V5m0 0l-7 7m7-7l7 7" />
              </svg>
              <span className="text-xs font-semibold hidden sm:inline">Send</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
