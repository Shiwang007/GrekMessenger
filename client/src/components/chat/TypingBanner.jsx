export default function TypingBanner({ typingText }) {
  if (!typingText) return null;

  return (
    <div className="px-4 py-1.5 text-xs text-indigo-400 bg-slate-900/60 flex items-center space-x-2 border-t border-white/5 animate-fade-in flex-shrink-0">
      <div className="flex space-x-1 items-center">
        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
      </div>
      <span className="font-medium italic">{typingText}</span>
    </div>
  );
}
