import { useState, useEffect } from "react";
import { searchUsers } from "../services/userApi";
import { useDebounce } from "./useDebounce";
import { getErrorMessage } from "../utils/error";

export function useUserSearch() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();

    if (!trimmed) {
      setUsers([]);
      setNextCursor(null);
      setError("");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadInitialUsers() {
      try {
        setLoading(true);
        setError("");

        const result = await searchUsers({
          query: trimmed,
          limit: 15,
        });

        if (cancelled) return;

        setUsers(result.users || []);
        setNextCursor(result.nextCursor || null);
      } catch (err) {
        if (cancelled) return;
        setError(getErrorMessage(err, "Unable to search users. Please try again."));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInitialUsers();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return;

    try {
      setLoadingMore(true);
      const result = await searchUsers({
        query: debouncedQuery.trim(),
        limit: 15,
        cursor: nextCursor,
      });

      setUsers((prev) => [...prev, ...(result.users || [])]);
      setNextCursor(result.nextCursor || null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load more users."));
    } finally {
      setLoadingMore(false);
    }
  }

  function handleClear() {
    setQuery("");
    setUsers([]);
    setNextCursor(null);
    setError("");
  }

  return {
    query,
    setQuery,
    users,
    hasMore: Boolean(nextCursor),
    loading,
    loadingMore,
    error,
    handleLoadMore,
    handleClear,
  };
}
