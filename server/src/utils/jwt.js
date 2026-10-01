import jwt from "jsonwebtoken";

export function generateAccessToken(userId) {
  return jwt.sign(
    {
      sub: userId,
      type: "access",
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",
    }
  );
}

export function verifyAccessToken(token) {
  const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  if (payload.type !== "access") {
    const error = new Error("Wrong token type");
    error.code = "WRONG_TOKEN_TYPE";
    throw error;
  }
  return payload;
}

