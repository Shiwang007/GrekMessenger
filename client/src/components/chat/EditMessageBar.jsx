import { CloseIcon } from "../common/Icons";

export default function EditMessageBar({
  editingContent,
  setEditingContent,
  onSave,
  onCancel,
}) {
  return (
    <div className="border-t border-white/10 bg-slate-900/80 backdrop-blur-md flex-shrink-0">
      <div className="px-3 py-2 flex items-center space-x-2 text-xs text-indigo-300 border-b border-white/5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        <span className="font-medium">Editing message</span>
        <button
          type="button"
          onClick={onCancel}
          className="ml-auto text-slate-400 hover:text-white transition-colors"
          title="Cancel edit"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="p-3 flex items-end space-x-2">
        <textarea
          autoFocus
          rows={1}
          value={editingContent}
          onChange={(e) => setEditingContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSave();
            }
            if (e.key === "Escape") {
              onCancel();
            }
          }}
          maxLength={5000}
          className="flex-1 bg-slate-800/80 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 resize-none max-h-36 leading-relaxed"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={!editingContent.trim()}
          className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl transition-all shadow-md flex-shrink-0"
          title="Save edit"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
