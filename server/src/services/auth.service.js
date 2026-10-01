import bcrypt from "bcrypt";
import crypto from "crypto";

import {
  createUser,
  findUserByEmail,
  findUserById,
  createRefreshToken,
  findRefreshTokenByHash,
  revokeRefreshToken,
} from "../repositories/auth.repository.js";

import { generateAccessToken } from "../utils/jwt.js";
import {
  generateRefreshToken,
  hashToken,
} from "../utils/tokens.js";

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
    last_seen_at: user.last_seen_at,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export async function signup({ email, password, name }) {
  const normalizedEmail = normalizeEmail(email);

  const existingUser = await findUserByEmail(normalizedEmail);

  if (existingUser) {
    const error = new Error("Email already registered");
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await createUser({
    id: crypto.randomUUID(),
    email: normalizedEmail,
    passwordHash,
    name: name.trim(),
  });

  return sanitizeUser(user);
}

export async function login({ email, password }) {
  const normalizedEmail = normalizeEmail(email);

  const user = await findUserByEmail(normalizedEmail);

  if (!user) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  const passwordMatches = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!passwordMatches) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  const accessToken = generateAccessToken(user.id);

  const rawRefreshToken = generateRefreshToken();
  const tokenHash = hashToken(rawRefreshToken);

  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  );

  await createRefreshToken({
    id: crypto.randomUUID(),
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken: rawRefreshToken,
  };
}

export async function refreshSession(rawRefreshToken) {
  if (!rawRefreshToken) {
    const error = new Error("Refresh token required");
    error.statusCode = 401;
    throw error;
  }

  const tokenHash = hashToken(rawRefreshToken);

  const storedToken =
    await findRefreshTokenByHash(tokenHash);

  if (!storedToken) {
    const error = new Error("Invalid refresh token");
    error.statusCode = 401;
    throw error;
  }

  if (storedToken.revoked_at) {
    const error = new Error("Refresh token revoked");
    error.statusCode = 401;
    throw error;
  }

  if (new Date(storedToken.expires_at) <= new Date()) {
    const error = new Error("Refresh token expired");
    error.statusCode = 401;
    throw error;
  }

  const user = await findUserById(storedToken.user_id);

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 401;
    throw error;
  }

  await revokeRefreshToken(storedToken.id);

  const accessToken = generateAccessToken(user.id);

  const newRawRefreshToken = generateRefreshToken();

  const newTokenHash = hashToken(
    newRawRefreshToken
  );

  const newExpiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  );

  await createRefreshToken({
    id: crypto.randomUUID(),
    userId: user.id,
    tokenHash: newTokenHash,
    expiresAt: newExpiresAt,
  });

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken: newRawRefreshToken,
  };
}

export async function logout(rawRefreshToken) {
  if (!rawRefreshToken) {
    return;
  }

  const tokenHash = hashToken(rawRefreshToken);

  const storedToken =
    await findRefreshTokenByHash(tokenHash);

  if (storedToken) {
    await revokeRefreshToken(storedToken.id);
  }
}

export async function getCurrentUser(userId) {
  const user = await findUserById(userId);

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 401;
    throw error;
  }

  return sanitizeUser(user);
}
