import { pool } from "../config/database.js";

export async function findUserByEmail(email) {
  const result = await pool.query(
    `
      SELECT id, email, password_hash, name, avatar_url,
             last_seen_at, created_at, updated_at
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email]
  );

  return result.rows[0] || null;
}

export async function findUserById(id) {
  const result = await pool.query(
    `
      SELECT id, email, name, avatar_url,
             last_seen_at, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

export async function createUser({ id, email, passwordHash, name }) {
  const result = await pool.query(
    `
      INSERT INTO users (
        id,
        email,
        password_hash,
        name
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, name, avatar_url,
                last_seen_at, created_at, updated_at
    `,
    [id, email, passwordHash, name]
  );

  return result.rows[0];
}

export async function createRefreshToken({ id, userId, tokenHash, expiresAt }) {
  const result = await pool.query(
    `
      INSERT INTO refresh_tokens (
        id,
        user_id,
        token_hash,
        expires_at
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id, user_id, expires_at, created_at
    `,
    [id, userId, tokenHash, expiresAt]
  );

  return result.rows[0];
}

export async function findRefreshTokenByHash(tokenHash) {
  const result = await pool.query(
    `
      SELECT id, user_id, token_hash, expires_at,
             revoked_at, created_at
      FROM refresh_tokens
      WHERE token_hash = $1
      LIMIT 1
    `,
    [tokenHash]
  );

  return result.rows[0] || null;
}

export async function revokeRefreshToken(id) {
  await pool.query(
    `
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE id = $1
        AND revoked_at IS NULL
    `,
    [id]
  );
}
