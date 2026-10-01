export function encodeCursor(value) {
  if (!value) return null;
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function decodeCursor(cursor) {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    );

    if (typeof parsed !== "object" || parsed === null || !parsed.id || !parsed.name) {
      throw new Error("INVALID_CURSOR");
    }

    return parsed;
  } catch {
    throw new Error("INVALID_CURSOR");
  }
}

export function decodeMessageCursor(cursor) {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    );

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !parsed.id ||
      typeof parsed.id !== "string" ||
      !parsed.createdAt ||
      isNaN(Date.parse(parsed.createdAt))
    ) {
      const error = new Error("Invalid message cursor.");
      error.statusCode = 400;
      error.code = "INVALID_CURSOR";
      throw error;
    }

    return parsed;
  } catch (err) {
    if (err.code === "INVALID_CURSOR") throw err;
    const error = new Error("Invalid message cursor.");
    error.statusCode = 400;
    error.code = "INVALID_CURSOR";
    throw error;
  }
}

