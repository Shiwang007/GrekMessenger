export function toSocketError(error) {
  return {
    ok: false,
    error: {
      code: error.code || "INTERNAL_ERROR",
      message: error.message || "Operation failed.",
    },
  };
}
