import ConnectionStatus from "../connection/ConnectionStatus";
import Avatar from "../common/Avatar";
import { ChatIcon } from "../common/Icons";

export default function AppHeader({ user, onLogout }) {
  return (
    <header className="h-16 border-b border-white/10 px-3 sm:px-6 flex items-center justify-between bg-slate-900/80 backdrop-blur-md sticky top-0 z-20 gap-2 flex-shrink-0">
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 flex-shrink-0">
          <ChatIcon className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm sm:text-lg font-bold text-white leading-tight truncate">
            GrekMessenger
          </h1>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
        <ConnectionStatus showText={true} />

        <div
          className="flex items-center sm:space-x-2.5 bg-white/5 border border-white/10 p-1 sm:px-3 sm:py-1.5 rounded-full"
          title={user?.name}
        >
          <Avatar
            src={user?.avatar_url}
            alt={user?.name}
            type="DIRECT"
            size="sm"
          />
          <span className="text-xs sm:text-sm font-medium text-slate-200 truncate hidden sm:inline max-w-[120px]">
            {user?.name}
          </span>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-all"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
