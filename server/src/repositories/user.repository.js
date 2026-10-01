import { pool } from "../config/database.js";

export async function searchUsers({
  currentUserId,
  query,
  cursorName,
  cursorId,
  limit,
}) {
  const pattern = `%${query}%`;

  const values = [
    currentUserId,
    pattern,
    cursorName,
    cursorId,
    limit,
  ];

  const result = await pool.query(
    `
      SELECT
        id,
        name,
        email,
        avatar_url
      FROM users
      WHERE
        id <> $1
        AND (
          name ILIKE $2
          OR email ILIKE $2
        )
        AND (
          $3::text IS NULL
          OR name > $3
          OR (name = $3 AND id > $4)
        )
      ORDER BY name ASC, id ASC
      LIMIT $5
    `,
    values
  );

  return result.rows;
}
