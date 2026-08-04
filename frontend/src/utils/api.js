const BASE = "/api";

async function request(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  register: (username, password) =>
    request("/auth/register", { method: "POST", body: { username, password } }),
  login: (username, password) =>
    request("/auth/login", { method: "POST", body: { username, password } }),
  me: (token) => request("/auth/me", { token }),
  updateProfile: (token, updates) =>
    request("/auth/profile", { method: "PUT", body: updates, token }),

  sendChat: (token, payload) =>
    request("/chat", { method: "POST", body: payload, token }),

  // HeyGen — native WebRTC flow via backend proxy
  heygenSession: (token, avatar) =>
    request("/heygen/session", { method: "POST", body: { avatarId: avatar }, token }),
  heygenStart: (token, sessionId, sdpAnswer) =>
    request("/heygen/start", { method: "POST", body: { sessionId, sdpAnswer }, token }),
  heygenIce: (token, sessionId, candidate) =>
    request("/heygen/ice", { method: "POST", body: { sessionId, candidate }, token }),
  heygenSpeak: (token, sessionId, text) =>
    request("/heygen/speak", { method: "POST", body: { sessionId, text }, token }),
  heygenStop: (token, sessionId) =>
    request("/heygen/stop", { method: "POST", body: { sessionId }, token }),

  adminVerify: (phrase) =>
    request("/admin/verify", { method: "POST", body: { phrase } }),
  adminUsers: (adminToken) => request("/admin/users", { token: adminToken }),
  adminUpdateUser: (adminToken, id, updates) =>
    request(`/admin/users/${id}`, { method: "PUT", body: updates, token: adminToken }),
  adminDeleteUser: (adminToken, id) =>
    request(`/admin/users/${id}`, { method: "DELETE", token: adminToken }),
  adminGetSettings: (adminToken) => request("/admin/settings", { token: adminToken }),
  adminUpdateSettings: (adminToken, updates) =>
    request("/admin/settings", { method: "PUT", body: updates, token: adminToken }),
};
