const BACKEND_URL = "https://emotional-intelligence-ai-n9du.vercel.app";
const BASE = `${BACKEND_URL}/api`;

async function request(path, { method = "GET", body, token } = {}) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
  const detail = [
    data.error,
    data.stage ? `Stage: ${data.stage}` : "",
    data.providerStatus ? `Status: ${data.providerStatus}` : "",
    data.detail || "",
  ].filter(Boolean).join(" | ");

  throw new Error(detail || `Request failed (${res.status})`);
}

  return data;
}

export const api = {
  // --- Authentication ---
  guest: () =>
    request("/auth/guest", {
      method: "POST",
    }),

  register: (username, password) =>
    request("/auth/register", {
      method: "POST",
      body: {
        username,
        password,
      },
    }),

  login: (username, password) =>
    request("/auth/login", {
      method: "POST",
      body: {
        username,
        password,
      },
    }),

  me: (token) =>
    request("/auth/me", {
      token,
    }),

  updateProfile: (token, updates) =>
    request("/auth/profile", {
      method: "PUT",
      body: updates,
      token,
    }),

  // --- AI Chat ---
  sendChat: (token, payload) =>
    request("/chat", {
      method: "POST",
      body: payload,
      token,
    }),

  // --- LiveAvatar / HeyGen ---
  // Creates a LiveAvatar session token on the backend.
  // The frontend LiveAvatar SDK uses this token to start
  // and manage the real-time avatar session.
  heygenSession: (token, avatar) =>
    request("/heygen/session", {
      method: "POST",
      body: {
        avatarId: avatar,
      },
      token,
    }),

  // Explicitly starts a LiveAvatar session when needed.
  // The SDK normally handles this internally, so this is
  // kept as a backend helper.
  heygenStart: (token, sessionToken) =>
    request("/heygen/start", {
      method: "POST",
      body: {
        sessionToken,
      },
      token,
    }),

  // Stops a LiveAvatar session.
  heygenStop: (token, sessionToken) =>
    request("/heygen/stop", {
      method: "POST",
      body: {
        sessionToken,
      },
      token,
    }),

  // --- Admin ---
  adminVerify: (phrase) =>
    request("/admin/verify", {
      method: "POST",
      body: {
        phrase,
      },
    }),

  adminUsers: (adminToken) =>
    request("/admin/users", {
      token: adminToken,
    }),

  adminUpdateUser: (adminToken, id, updates) =>
    request(`/admin/users/${id}`, {
      method: "PUT",
      body: updates,
      token: adminToken,
    }),

  adminDeleteUser: (adminToken, id) =>
    request(`/admin/users/${id}`, {
      method: "DELETE",
      token: adminToken,
    }),

  adminGetSettings: (adminToken) =>
    request("/admin/settings", {
      token: adminToken,
    }),

  adminUpdateSettings: (adminToken, updates) =>
    request("/admin/settings", {
      method: "PUT",
      body: updates,
      token: adminToken,
    }),
};
