const express = require("express");
const rateLimit = require("express-rate-limit");
const { requireAuth } = require("../middleware/auth");
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

router.post("/", requireAuth, chatLimiter, async (req, res) => {
  const { message, language, voice, history } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({
      error: "Message is required",
    });
  }

  try {
    // Step 1: Detect emotion.
    // detectEmotion already has its own fallback,
    // so Hume failure will not stop the chat.
    const emotion = await detectEmotion(message);

    // Step 2: Generate AI reply.
    const replyText = await generateReply({
      message,
      emotion,
      language: language || "en",
      history: Array.isArray(history) ? history : [],
    });

    // Step 3: TTS is optional.
    // If ElevenLabs fails, the text reply still works.
    let audioBase64 = null;

    try {
      audioBase64 = await synthesizeSpeech({
        text: replyText,
        voiceKey: voice || "GIGI",
        emotion,
      });
    } catch (ttsErr) {
      console.warn(
        "TTS failed (non-fatal):",
        ttsErr?.response?.data || ttsErr?.message || ttsErr
      );
    }

    return res.json({
      emotion,
      reply: replyText,
      audio: audioBase64
        ? `data:audio/mpeg;base64,${audioBase64}`
        : null,
    });
  } catch (err) {
    console.error(
      "Chat pipeline error:",
      err?.response?.data || err?.stack || err?.message || err
    );

    return res.status(502).json({
      error: "AI pipeline failed. Please try again.",
    });
  }
});

module.exports = router;
