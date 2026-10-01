import api from "./api";

export async function searchUsers({
  query,
  limit = 20,
  cursor = null,
}) {
  const params = {
    q: query,
    limit,
  };

  if (cursor) {
    params.cursor = cursor;
  }

  const response = await api.get("/users/search", {
    params,
  });

  return response.data;
}
