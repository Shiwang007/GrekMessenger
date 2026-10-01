/**
 * Extracts a user-facing error message from an API or Axios error.
 *
 * @param {any} err - The caught error
 * @param {string} fallback - Default message if no error message is found
 * @returns {string}
 */
export function getErrorMessage(err, fallback = "An unexpected error occurred.") {
  return err?.response?.data?.message || err?.message || fallback;
}
