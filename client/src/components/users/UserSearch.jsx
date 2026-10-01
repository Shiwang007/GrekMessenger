import { useUserSearch } from "../../hooks/useUserSearch";
import Spinner from "../common/Spinner";
import { CloseIcon } from "../common/Icons";

export default function UserSearch({ onSelectUser }) {
  const {
    query,
    setQuery,
    users,
    hasMore,
    loading,
    loadingMore,
    error,
    handleLoadMore,
    handleClear,
  } = useUserSearch();

  return (
    <div className="w-full flex flex-col h-full">
      {/* Search Input Bar */}
      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full pl-10 pr-9 py-2.5 bg-slate-800/80 border border-white/10 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
            title="Clear search"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* State: Loading */}
      {loading && (
        <div className="py-8 flex flex-col items-center justify-center text-slate-400 space-y-2">
          <Spinner size="md" />
          <span className="text-xs">Searching users...</span>
        </div>
      )}

      {/* State: Error */}
      {error && !loading && (
        <div className="p-3 mb-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setQuery(query)}
            className="underline font-semibold hover:text-red-200 ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* State: Empty Query Prompt */}
      {!loading && !query.trim() && (
        <div className="py-10 text-center text-slate-500 text-xs">
          Type a name or email to find contacts
        </div>
      )}

      {/* State: No Results */}
      {!loading && query.trim() && users.length === 0 && !error && (
        <div className="py-10 text-center text-slate-400 text-xs flex flex-col items-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p>No users found matching &ldquo;{query}&rdquo;</p>
        </div>
      )}

      {/* State: Results List */}
      {!loading && users.length > 0 && (
        <div className="space-y-1.5 overflow-y-auto max-h-96 pr-1">
          {users.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => onSelectUser?.(user)}
              className="w-full flex items-center space-x-3 p-2.5 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors text-left group border border-transparent hover:border-white/5"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-9 h-9 rounded-full bg-slate-700 object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 font-bold flex items-center justify-center text-xs flex-shrink-0">
                  {user.name?.[0]?.toUpperCase() || "U"}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-100 truncate group-hover:text-indigo-300 transition-colors">
                  {user.name}
                </div>
                <div className="text-xs text-slate-400 truncate">{user.email}</div>
              </div>

              <div className="text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                <span>Select</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}

          {/* Load More Button */}
          {hasMore && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-1.5 text-xs font-medium text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg transition-all disabled:opacity-50"
              >
                {loadingMore ? "Loading more..." : "Load more results"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
