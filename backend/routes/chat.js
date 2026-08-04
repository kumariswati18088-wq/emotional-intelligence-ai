const express = require("express");
const rateLimit = require("express-rate-limit");
const { requireAuth } = require("../middleware/auth");
const { readDb } = require("../utils/store");
const {
  detectEmotion,
  generateReply,
  synthesizeSpeech,
} = require("../utils/providers");

const router = express.Router();

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/chat
// body: { message, language, voice, history: [{role, text}] }
router.post("/", requireAuth, chatLimiter, async (req, res) => {
  const { message, language, voice, history } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const db = readDb();
    const enginesOn = db.settings.emotionEngines;

    // Step 1: Hume — extract emotional state (guarded by admin toggle)
    const emotion = enginesOn.hume ? await detectEmotion(message) : "Neutral";

    // Step 2: Gemini — generate reply text in the selected language
    const replyText = await generateReply({
      message,
      emotion,
      language: language || "en",
      history: history || [],
    });

    // Step 3: ElevenLabs — synthesize emotional speech with chosen voice
    let audioBase64 = null;
    try {
      audioBase64 = await synthesizeSpeech({
        text: replyText,
        voiceKey: voice || "GIGI",
        emotion,
      });
    } catch (ttsErr) {
      // Speech synthesis is best-effort; text reply still returns.
      audioBase64 = null;
    }

    res.json({
      emotion,
      reply: replyText,
      audio: audioBase64 ? `data:audio/mpeg;base64,${audioBase64}` : null,
    });
  } catch (err) {
    console.error("Chat pipeline error:", err.message);
    res.status(502).json({ error: "AI pipeline failed. Please try again." });
  }
});

module.exports = router;
