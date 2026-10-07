const express = require("express");
const axios = require("axios");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const LIVEAVATAR_BASE = "https://api.liveavatar.com";

function liveAvatarHeaders() {
  return {
    "X-API-KEY": process.env.HEYGEN_API_KEY || "",
    "Content-Type": "application/json",
  };
}

// --- Step 1: Create LiveAvatar session token ---
// The backend keeps the LiveAvatar API key private and creates a
// short-lived session token for the frontend LiveAvatar Web SDK.
router.post("/session", requireAuth, async (req, res) => {
  if (!process.env.HEYGEN_API_KEY) {
    return res.status(503).json({
      error: "HeyGen/LiveAvatar API key not configured",
    });
  }

  const { avatarId } = req.body;

  if (!avatarId) {
    return res.status(400).json({
      error: "avatarId is required",
    });
  }

  try {
    const response = await axios.post(
      `${LIVEAVATAR_BASE}/v1/sessions/token`,
      {
        mode: "FULL",
        avatar_id: avatarId,
      },
      {
        headers: liveAvatarHeaders(),
        timeout: 15000,
      }
    );

    const data = response.data?.data;

    if (!data?.session_token) {
      console.error("LiveAvatar token response:", response.data);

      return res.status(502).json({
        error: "LiveAvatar did not return a session token",
      });
    }

    res.json({
      sessionToken: data.session_token,
      sessionId: data.session_id || null,
    });
  } catch (err) {
    const detail = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;

    console.error("LiveAvatar session token error:", detail);

    res.status(502).json({
      error: `LiveAvatar session error: ${detail}`,
    });
  }
});

// --- Step 2: Start LiveAvatar session ---
// The frontend SDK normally handles the LiveKit/WebSocket connection.
// This endpoint is kept as a backend helper for cases where the
// application needs to explicitly start a session from the backend.
router.post("/start", requireAuth, async (req, res) => {
  const { sessionToken } = req.body;

  if (!sessionToken) {
    return res.status(400).json({
      error: "sessionToken is required",
    });
  }

  try {
    const response = await axios.post(
      `${LIVEAVATAR_BASE}/v1/sessions/start`,
      {},
      {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    res.json(response.data);
  } catch (err) {
    const detail = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;

    console.error("LiveAvatar start error:", detail);

    res.status(502).json({
      error: `LiveAvatar start error: ${detail}`,
    });
  }
});

// --- Step 3: Stop LiveAvatar session ---
// The LiveAvatar Web SDK normally performs cleanup when session.stop()
// is called. This endpoint is provided for explicit server-side cleanup.
router.post("/stop", requireAuth, async (req, res) => {
  const { sessionToken } = req.body;

  if (!sessionToken) {
    return res.json({ ok: true });
  }

  try {
    await axios.post(
      `${LIVEAVATAR_BASE}/v1/sessions/stop`,
      {},
      {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    res.json({ ok: true });
  } catch (err) {
    const detail = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;

    console.warn("LiveAvatar stop error (non-fatal):", detail);

    res.json({ ok: true });
  }
});

// --- Step 4: Legacy compatibility endpoint ---
// Kept so older frontend code does not immediately break while the
// frontend LiveAvatar SDK migration is completed in the next step.
router.get("/token", requireAuth, async (_req, res) => {
  if (!process.env.HEYGEN_API_KEY) {
    return res.status(503).json({
      error: "HeyGen/LiveAvatar API key not configured",
    });
  }

  return res.status(410).json({
    error:
      "The old HeyGen Streaming token endpoint has been replaced by the LiveAvatar session endpoint.",
  });
});

// --- Step 5: Legacy ICE endpoint ---
// ICE handling is now managed by the LiveAvatar Web SDK/LiveKit.
router.post("/ice", requireAuth, async (_req, res) => {
  return res.status(410).json({
    error:
      "ICE is managed automatically by the LiveAvatar Web SDK.",
  });
});

// --- Step 6: Legacy speak endpoint ---
// Text/avatar commands will be handled by the LiveAvatar Web SDK.
// The frontend will use the SDK's avatar text command in the next step.
router.post("/speak", requireAuth, async (_req, res) => {
  return res.status(410).json({
    error:
      "Avatar speech is now handled by the LiveAvatar Web SDK.",
  });
});

module.exports = router;
