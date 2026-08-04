const express = require("express");
const axios = require("axios");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const HEYGEN_BASE = "https://api.heygen.com";

function heygenHeaders() {
  return {
    "X-Api-Key": process.env.HEYGEN_API_KEY || "",
    "Content-Type": "application/json",
  };
}

// GET /api/heygen/token — short-lived streaming token (kept for compatibility)
router.get("/token", requireAuth, async (_req, res) => {
  if (!process.env.HEYGEN_API_KEY) {
    return res.status(503).json({ error: "HeyGen API key not configured" });
  }
  try {
    const { data } = await axios.post(
      `${HEYGEN_BASE}/v1/streaming.create_token`,
      {},
      { headers: heygenHeaders(), timeout: 10000 }
    );
    res.json({ token: data?.data?.token });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// POST /api/heygen/session — create WebRTC streaming session
// body: { avatarId, voiceId }
// Returns: { sessionId, sdpOffer, iceServers }
router.post("/session", requireAuth, async (req, res) => {
  if (!process.env.HEYGEN_API_KEY) {
    return res.status(503).json({ error: "HeyGen API key not configured" });
  }
  const { avatarId, voiceId } = req.body;
  try {
    const { data } = await axios.post(
      `${HEYGEN_BASE}/v1/streaming.new`,
      {
        quality: "low",
        avatar_name: avatarId || "",
        voice: { voice_id: voiceId || "" },
        version: "v2",
      },
      { headers: heygenHeaders(), timeout: 15000 }
    );
    res.json({
      sessionId: data?.data?.session_id,
      sdpOffer: data?.data?.sdp,
      iceServers: data?.data?.ice_servers2 || [],
    });
  } catch (err) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    res.status(502).json({ error: `HeyGen session error: ${detail}` });
  }
});

// POST /api/heygen/start — send SDP answer to HeyGen
// body: { sessionId, sdpAnswer: { type, sdp } }
router.post("/start", requireAuth, async (req, res) => {
  if (!process.env.HEYGEN_API_KEY) {
    return res.status(503).json({ error: "HeyGen API key not configured" });
  }
  const { sessionId, sdpAnswer } = req.body;
  try {
    const { data } = await axios.post(
      `${HEYGEN_BASE}/v1/streaming.start`,
      { session_id: sessionId, sdp: sdpAnswer },
      { headers: heygenHeaders(), timeout: 10000 }
    );
    res.json(data);
  } catch (err) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    res.status(502).json({ error: `HeyGen start error: ${detail}` });
  }
});

// POST /api/heygen/ice — forward ICE candidate to HeyGen
// body: { sessionId, candidate: { candidate, sdpMid, sdpMLineIndex } }
router.post("/ice", requireAuth, async (req, res) => {
  if (!process.env.HEYGEN_API_KEY) {
    return res.status(503).json({ error: "HeyGen API key not configured" });
  }
  const { sessionId, candidate } = req.body;
  try {
    const { data } = await axios.post(
      `${HEYGEN_BASE}/v1/streaming.ice`,
      { session_id: sessionId, candidate },
      { headers: heygenHeaders(), timeout: 8000 }
    );
    res.json(data);
  } catch (err) {
    // ICE errors are non-fatal — log and return ok so the client keeps running
    console.warn("HeyGen ICE error (non-fatal):", err.message);
    res.json({ ok: true });
  }
});

// POST /api/heygen/speak — make the avatar speak text
// body: { sessionId, text }
router.post("/speak", requireAuth, async (req, res) => {
  if (!process.env.HEYGEN_API_KEY) {
    return res.status(503).json({ error: "HeyGen API key not configured" });
  }
  const { sessionId, text } = req.body;
  if (!sessionId || !text) {
    return res.status(400).json({ error: "sessionId and text are required" });
  }
  try {
    const { data } = await axios.post(
      `${HEYGEN_BASE}/v1/streaming.task`,
      { session_id: sessionId, text, task_type: "repeat" },
      { headers: heygenHeaders(), timeout: 10000 }
    );
    res.json(data);
  } catch (err) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    res.status(502).json({ error: `HeyGen speak error: ${detail}` });
  }
});

// POST /api/heygen/stop — stop the streaming session
// body: { sessionId }
router.post("/stop", requireAuth, async (req, res) => {
  if (!process.env.HEYGEN_API_KEY) {
    return res.json({ ok: true });
  }
  const { sessionId } = req.body;
  try {
    await axios.post(
      `${HEYGEN_BASE}/v1/streaming.stop`,
      { session_id: sessionId },
      { headers: heygenHeaders(), timeout: 8000 }
    );
    res.json({ ok: true });
  } catch (err) {
    console.warn("HeyGen stop error (non-fatal):", err.message);
    res.json({ ok: true });
  }
});

module.exports = router;
