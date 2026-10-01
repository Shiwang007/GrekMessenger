import * as userRepository from "../repositories/user.repository.js";
import { encodeCursor, decodeCursor } from "../utils/cursor.js";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatar_url,
  };
}

export async function searchUsers({
  currentUserId,
  query,
  limit,
  cursor,
}) {
  const normalizedQuery = query?.trim() ?? "";

  if (!normalizedQuery) {
    return {
      users: [],
      nextCursor: null,
    };
  }

  const parsedLimit = Number(limit) || DEFAULT_LIMIT;
  const safeLimit = Math.min(Math.max(parsedLimit, 1), MAX_LIMIT);

  const decodedCursor = decodeCursor(cursor);

  const rows = await userRepository.searchUsers({
    currentUserId,
    query: normalizedQuery,
    cursorName: decodedCursor?.name ?? null,
    cursorId: decodedCursor?.id ?? null,
    limit: safeLimit + 1,
  });

  const hasMore = rows.length > safeLimit;
  const users = rows.slice(0, safeLimit);

  const nextCursor =
    hasMore && users.length
      ? encodeCursor({
          name: users[users.length - 1].name,
          id: users[users.length - 1].id,
        })
      : null;

  return {
    users: users.map(toPublicUser),
    nextCursor,
  };
}
