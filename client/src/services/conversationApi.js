import api from "./api";

export async function createDirectConversation(userId) {
  const response = await api.post("/conversations/direct", {
    userId,
  });
  return response.data;
}

export async function getConversations() {
  const response = await api.get("/conversations");
  return response.data;
}

export async function getConversation(conversationId) {
  const response = await api.get(`/conversations/${conversationId}`);
  return response.data;
}

export async function createGroup({ name, avatarUrl = null }) {
  const response = await api.post("/conversations/groups", {
    name,
    avatarUrl,
  });
  return response.data;
}

export async function updateGroup(conversationId, data) {
  const response = await api.patch(`/conversations/${conversationId}`, data);
  return response.data;
}

export async function addMember(conversationId, userId) {
  const response = await api.post(`/conversations/${conversationId}/members`, {
    userId,
  });
  return response.data;
}

export async function removeMember(conversationId, userId) {
  const response = await api.delete(`/conversations/${conversationId}/members/${userId}`);
  return response.data;
}

export async function changeMemberRole(conversationId, userId, role) {
  const response = await api.patch(`/conversations/${conversationId}/members/${userId}/role`, {
    role,
  });
  return response.data;
}

export async function transferOwnership(conversationId, userId) {
  const response = await api.post(`/conversations/${conversationId}/transfer-ownership`, {
    userId,
  });
  return response.data;
}

export async function deleteGroup(conversationId) {
  const response = await api.delete(`/conversations/${conversationId}`);
  return response.data;
}
