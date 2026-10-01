import { verifyAccessToken } from "../utils/jwt.js";

export function authenticate(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const token = authorization.substring(7);

  try {
    const payload = verifyAccessToken(token);

    if (payload.type !== "access" || !payload.sub) {
      return res.status(401).json({
        message: "Invalid access token",
      });
    }

    req.user = {
      id: payload.sub,
    };

    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired access token",
    });
  }
}
