const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

async function request(path, { token, method = "GET", body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Requête API impossible");
  }
  return payload;
}

export const communityApi = {
  register: (body) => request("/auth/register", { method: "POST", body }),
  login: (body) => request("/auth/login", { method: "POST", body }),
  me: (token) => request("/me", { token }),
  updateMe: (token, body) => request("/me", { token, method: "PATCH", body }),
  searchUsers: (q, token) =>
    request(`/users/search?q=${encodeURIComponent(q || "")}`, { token }),
  userProfile: (userId, token) =>
    request(`/users/${userId}/profile`, { token }),
  addFriend: (token, friendId) =>
    request("/friends", { token, method: "POST", body: { friendId } }),
  acceptFriendRequest: (token, requestId) =>
    request(`/friends/requests/${requestId}`, { token, method: "POST" }),
  rejectFriendRequest: (token, requestId) =>
    request(`/friends/requests/${requestId}`, { token, method: "DELETE" }),
  removeFriend: (token, friendId) =>
    request(`/friends/${friendId}`, { token, method: "DELETE" }),
  myTierlists: (token) => request("/tierlists/me", { token }),
  publicFeed: (token) => request("/public-feed", { token }),
  leaderboard: (token) => request("/leaderboard", { token }),
  createTierlist: (token, body) =>
    request("/tierlists", { token, method: "POST", body }),
  updateTierlist: (token, id, body) =>
    request(`/tierlists/${id}`, { token, method: "PATCH", body }),
  deleteTierlist: (token, id) =>
    request(`/tierlists/${id}`, { token, method: "DELETE" }),
  getTierlist: (id, token) => request(`/tierlists/${id}`, { token }),
  adminUsers: (token) => request("/admin/users", { token }),
  adminTierlists: (token) => request("/admin/tierlists", { token }),
  adminDeleteTierlist: (token, id) =>
    request(`/admin/tierlists/${id}`, { token, method: "DELETE" }),
  adminDeleteUser: (token, id) =>
    request(`/admin/users/${id}`, { token, method: "DELETE" }),
};
