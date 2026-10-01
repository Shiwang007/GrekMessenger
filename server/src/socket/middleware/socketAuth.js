import { verifyAccessToken } from "../../utils/jwt.js";

export function socketAuth(socket, next) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    const error = new Error("AUTH_REQUIRED");
    error.data = { code: "AUTH_REQUIRED" };
    return next(error);
  }

  try {
    const payload = verifyAccessToken(token);

    socket.user = {
      id: payload.sub,
      tokenExp: payload.exp,
    };

    next();
  } catch (error) {
    const code =
      error.name === "TokenExpiredError" ? "AUTH_EXPIRED" : "AUTH_INVALID";
    const authError = new Error(code);
    authError.data = { code };
    next(authError);
  }
}
