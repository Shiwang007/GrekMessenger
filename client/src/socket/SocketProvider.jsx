import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { socket } from "./socket";
import { useAuth } from "../context/AuthContext";
import { joinConversation } from "./conversationSocket";

export const CONNECTION_STATES = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  RECONNECTING: "reconnecting",
  CONNECTED: "connected",
  SYNCING: "syncing",
  READY: "ready",
  ERROR: "error",
};

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user, accessToken, refreshSession } = useAuth();
  const [status, setStatus] = useState(CONNECTION_STATES.DISCONNECTED);
  const isRefreshingRef = useRef(false);

  // Map of conversationId -> syncHandler function
  const activeSubscriptionsRef = useRef(new Map());

  const registerSubscription = useCallback((conversationId, syncHandler) => {
    if (!conversationId) return () => {};
    activeSubscriptionsRef.current.set(conversationId, syncHandler);

    return () => {
      activeSubscriptionsRef.current.delete(conversationId);
    };
  }, []);

  useEffect(() => {
    if (!user || !accessToken) {
      if (socket.connected) {
        socket.disconnect();
      }
      setStatus(CONNECTION_STATES.DISCONNECTED);
      return;
    }

    let isMounted = true;

    async function handleRefreshAndReconnect() {
      if (isRefreshingRef.current) return;
      try {
        isRefreshingRef.current = true;
        setStatus(CONNECTION_STATES.CONNECTING);
        const newToken = await refreshSession();

        if (newToken && isMounted) {
          socket.auth = { token: newToken };
          socket.connect();
        } else if (isMounted) {
          socket.disconnect();
          setStatus(CONNECTION_STATES.DISCONNECTED);
        }
      } catch {
        if (isMounted) {
          socket.disconnect();
          setStatus(CONNECTION_STATES.DISCONNECTED);
        }
      } finally {
        isRefreshingRef.current = false;
      }
    }

    const handleConnect = async () => {
      if (!isMounted) return;
      setStatus(CONNECTION_STATES.CONNECTED);

      // Rejoin active conversation rooms and sync missed messages
      if (activeSubscriptionsRef.current.size > 0) {
        setStatus(CONNECTION_STATES.SYNCING);
        for (const [conversationId, syncHandler] of activeSubscriptionsRef.current.entries()) {
          try {
            await joinConversation(conversationId);
            if (syncHandler) {
              await syncHandler();
            }
          } catch (err) {
            console.warn(`Sync failed for conversation ${conversationId}:`, err);
            if (err?.message === "CONVERSATION_ACCESS_DENIED") {
              activeSubscriptionsRef.current.delete(conversationId);
            }
          }
        }
      }

      if (isMounted) {
        setStatus(CONNECTION_STATES.READY);
      }
    };

    const handleDisconnect = (reason) => {
      if (!isMounted) return;
      if (reason === "io client disconnect") {
        setStatus(CONNECTION_STATES.DISCONNECTED);
      } else {
        // Socket.IO is attempting automatic reconnection
        setStatus(CONNECTION_STATES.RECONNECTING);
      }
    };

    const handleConnectError = async (error) => {
      if (!isMounted) return;

      const code = error?.data?.code || error?.message;

      if (code === "AUTH_EXPIRED" || code === "AUTH_INVALID") {
        await handleRefreshAndReconnect();
      } else {
        setStatus(CONNECTION_STATES.ERROR);
      }
    };

    const handleAuthExpired = async () => {
      if (isMounted) {
        await handleRefreshAndReconnect();
      }
    };

    const handleReconnectAttempt = () => {
      if (isMounted) setStatus(CONNECTION_STATES.RECONNECTING);
    };

    const handleReconnectError = () => {
      if (isMounted) setStatus(CONNECTION_STATES.RECONNECTING);
    };

    const handleReconnectFailed = () => {
      if (isMounted) setStatus(CONNECTION_STATES.ERROR);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("auth:expired", handleAuthExpired);

    if (socket.io) {
      socket.io.on("reconnect_attempt", handleReconnectAttempt);
      socket.io.on("reconnect_error", handleReconnectError);
      socket.io.on("reconnect_failed", handleReconnectFailed);
    }

    // Attach JWT credentials & connect
    socket.auth = { token: accessToken };
    setStatus(CONNECTION_STATES.CONNECTING);
    socket.connect();

    return () => {
      isMounted = false;
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("auth:expired", handleAuthExpired);

      if (socket.io) {
        socket.io.off("reconnect_attempt", handleReconnectAttempt);
        socket.io.off("reconnect_error", handleReconnectError);
        socket.io.off("reconnect_failed", handleReconnectFailed);
      }
    };
  }, [user?.id, accessToken]);

  const isConnected =
    status === CONNECTION_STATES.READY ||
    status === CONNECTION_STATES.CONNECTED ||
    status === CONNECTION_STATES.SYNCING;

  return (
    <SocketContext.Provider
      value={{
        socket,
        status,
        connectionState: status,
        isConnected,
        isSyncing: status === CONNECTION_STATES.SYNCING,
        registerSubscription,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}

