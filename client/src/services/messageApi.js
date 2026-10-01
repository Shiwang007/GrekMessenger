import api from "./api";

export async function getMessages(
  conversationId,
  { limit = 50, before = null } = {}
) {
  const params = { limit };
  if (before) {
    params.before = before;
  }

  const response = await api.get(`/conversations/${conversationId}/messages`, {
    params,
  });

  return response.data;
}

export async function sendMessage(
  conversationId,
  { clientMessageId, content }
) {
  const response = await api.post(
    `/conversations/${conversationId}/messages`,
    {
      clientMessageId,
      content,
    }
  );

  return response.data;
}
