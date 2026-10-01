export function scheduleTokenExpiry(socket) {
  if (!socket.user?.tokenExp) return;

  const expiresAt = socket.user.tokenExp * 1000;
  const delay = expiresAt - Date.now();

  if (delay <= 0) {
    socket.emit("auth:expired", {
      code: "AUTH_TOKEN_EXPIRED",
    });
    socket.disconnect(true);
    return;
  }

  const timer = setTimeout(() => {
    socket.emit("auth:expired", {
      code: "AUTH_TOKEN_EXPIRED",
    });

    setTimeout(() => {
      socket.disconnect(true);
    }, 100);
  }, delay);

  socket.once("disconnect", () => {
    clearTimeout(timer);
  });
}
