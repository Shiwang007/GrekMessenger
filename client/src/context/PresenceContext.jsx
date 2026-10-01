import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { socket } from "../socket/socket";

const PresenceContext = createContext(null);

export function PresenceProvider({ children }) {
  // Map of userId -> { online: boolean, lastSeenAt: string | null }
  const [presenceMap, setPresenceMap] = useState(new Map());

  // Listen to server presence:update events
  useEffect(() => {
    function handlePresenceUpdate(update) {
      if (!update?.userId) return;

      setPresenceMap((prev) => {
        const next = new Map(prev);
        next.set(update.userId, {
          online: Boolean(update.online),
          lastSeenAt: update.lastSeenAt || null,
        });
        return next;
      });
    }

    socket.on("presence:update", handlePresenceUpdate);

    return () => {
      socket.off("presence:update", handlePresenceUpdate);
    };
  }, []);

  // Bulk-populate or seed presence snapshot from conversation/member API responses
  const setPresenceSnapshot = useCallback((usersList) => {
    if (!Array.isArray(usersList) || usersList.length === 0) return;

    setPresenceMap((prev) => {
      const next = new Map(prev);
      for (const u of usersList) {
        if (!u?.id) continue;
        next.set(u.id, {
          online: Boolean(u.online),
          lastSeenAt: u.lastSeenAt || null,
        });
      }
      return next;
    });
  }, []);

  const getPresence = useCallback(
    (userId) => {
      if (!userId) return { online: false, lastSeenAt: null };
      return presenceMap.get(userId) || { online: false, lastSeenAt: null };
    },
    [presenceMap]
  );

  return (
    <PresenceContext.Provider
      value={{
        presenceMap,
        getPresence,
        setPresenceSnapshot,
      }}
    >
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence(userId) {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error("usePresence must be used within a PresenceProvider");
  }

  if (!userId) {
    return context;
  }

  return context.getPresence(userId);
}
