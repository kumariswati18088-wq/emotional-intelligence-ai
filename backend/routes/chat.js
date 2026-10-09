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

  let stage = "starting";

  try {
    // ============================================================
    // STEP 1 — HUME EMOTION
    // ============================================================

    stage = "Hume emotion detection";

    const emotion = await detectEmotion(message);

    console.log("CHAT STEP 1 OK — Hume:", emotion);

    // ============================================================
    // STEP 2 — GEMINI REPLY
    // ============================================================

    stage = "Gemini reply generation";

    const replyText = await generateReply({
      message,
      emotion,
      language: language || "en",
      history: Array.isArray(history) ? history : [],
    });

    console.log("CHAT STEP 2 OK — Gemini reply generated");

    // ============================================================
    // STEP 3 — ELEVENLABS TTS
    // ============================================================

    let audioBase64 = null;

    try {
      stage = "ElevenLabs TTS";

      audioBase64 = await synthesizeSpeech({
        text: replyText,
        voiceKey: voice || "GIGI",
        emotion,
      });

      console.log("CHAT STEP 3 OK — ElevenLabs TTS");
    } catch (ttsErr) {
      console.warn(
        "CHAT STEP 3 FAILED — TTS is non-fatal:",
        ttsErr?.response?.data ||
          ttsErr?.message ||
          ttsErr
      );

      audioBase64 = null;
    }

    // ============================================================
    // SUCCESS
    // ============================================================

    return res.json({
      emotion,
      reply: replyText,
      audio: audioBase64
        ? `data:audio/mpeg;base64,${audioBase64}`
        : null,
    });
  } catch (err) {
    const status = err?.response?.status || null;

    const providerError =
      err?.response?.data ||
      err?.message ||
      String(err);

    console.error("================================");
    console.error("CHAT PIPELINE FAILED");
    console.error("FAILED STAGE:", stage);
    console.error("HTTP STATUS:", status);
    console.error(
      "PROVIDER ERROR:",
      JSON.stringify(providerError, null, 2)
    );
    console.error("================================");

    const providerDetail =
      typeof providerError === "string"
        ? providerError
        : JSON.stringify(providerError);

    const quotaMessage =
      status === 429
        ? "The AI provider quota/rate limit has been reached. Please wait for the quota to reset or check the Gemini API plan."
        : `AI pipeline failed at ${stage}. HTTP status: ${status || "unknown"}.`;

    return res.status(status === 429 ? 429 : 502).json({
      error: quotaMessage,
      stage,
      providerStatus: status,
      detail: providerDetail,
    });
  }
});

module.exports = router;
