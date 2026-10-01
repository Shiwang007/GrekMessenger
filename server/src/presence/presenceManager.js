// In-memory active socket registry per user
const userSockets = new Map();

/**
 * Register a connected socket for an authenticated user.
 * Returns { becameOnline: boolean }
 */
export function addSocket(userId, socketId) {
  let sockets = userSockets.get(userId);
  const wasOffline = !sockets || sockets.size === 0;

  if (!sockets) {
    sockets = new Set();
    userSockets.set(userId, sockets);
  }

  sockets.add(socketId);

  return {
    becameOnline: wasOffline,
  };
}

/**
 * Remove a disconnected socket for a user.
 * Disconnect handling is idempotent via Set.delete.
 * Returns { becameOffline: boolean }
 */
export function removeSocket(userId, socketId) {
  const sockets = userSockets.get(userId);

  if (!sockets) {
    return {
      becameOffline: false,
    };
  }

  sockets.delete(socketId);

  if (sockets.size === 0) {
    userSockets.delete(userId);
    return {
      becameOffline: true,
    };
  }

  return {
    becameOffline: false,
  };
}

/**
 * Check if user has at least one active socket connected.
 */
export function isOnline(userId) {
  return (userSockets.get(userId)?.size ?? 0) > 0;
}

/**
 * Get all user IDs currently connected.
 */
export function getOnlineUserIds() {
  return Array.from(userSockets.keys());
}
