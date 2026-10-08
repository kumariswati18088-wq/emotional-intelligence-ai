const axios = require("axios");

const AVATAR_MAP = {
  GIRL1: () => process.env.GIRL1_AVATAR_ID,
  GIRL2: () => process.env.GIRL2_AVATAR_ID,
  BOY1: () => process.env.BOY1_AVATAR_ID,
  BOY2: () => process.env.BOY2_AVATAR_ID,
};

const VOICE_MAP = {
  ADAM: () => process.env.VOICE_ADAM,
  GIGI: () => process.env.VOICE_GIGI,
  MATILDA: () => process.env.VOICE_MATILDA,
};

function resolveAvatarId(key) {
  const fn = AVATAR_MAP[key];
  return fn ? fn() : null;
}

function resolveVoiceId(key) {
  const fn = VOICE_MAP[key];
  return fn ? fn() : null;
}

// ============================================================
// HUME AI — Emotion Detection
// ============================================================

async function detectEmotion(text) {
  try {
    if (!process.env.HUME_API_KEY) {
      return heuristicEmotion(text);
    }

    const response = await axios.post(
      "https://api.hume.ai/v0/batch/jobs",
      {
        models: {
          language: {},
        },
        text: [text],
      },
      {
        headers: {
          "X-Hume-Api-Key": process.env.HUME_API_KEY,
          "Content-Type": "application/json",
        },
        timeout: 8000,
      }
    );

    const predictions = response.data?.predictions;

    if (predictions?.length) {
      const emotions = predictions[0]?.emotions;

      if (Array.isArray(emotions) && emotions.length) {
        const top = [...emotions].sort(
          (a, b) => (b.score || 0) - (a.score || 0)
        )[0];

        if (top?.name) {
          return normalizeEmotion(top.name);
        }
      }
    }

    return heuristicEmotion(text);
  } catch (err) {
    console.warn(
      "Hume emotion detection failed:",
      err?.response?.data || err?.message || err
    );

    return heuristicEmotion(text);
  }
}

function normalizeEmotion(rawName) {
  const map = {
    joy: "Joy",
    happiness: "Joy",
    sadness: "Sadness",
    distress: "Crying",
    amusement: "Laughing",
    anger: "Anger",
    fear: "Fear",
    surprise: "Surprise",
    calmness: "Neutral",
  };

  const key = String(rawName || "").toLowerCase();

  return map[key] || rawName || "Neutral";
}

function heuristicEmotion(text) {
  const t = String(text || "").toLowerCase();

  if (/(haha|lol|lmao|funny|hilarious)/.test(t)) {
    return "Laughing";
  }

  if (/(crying|sobbing|tears)/.test(t)) {
    return "Crying";
  }

  if (/(sad|depressed|down|hurt|lonely|cry)/.test(t)) {
    return "Sadness";
  }

  if (/(angry|furious|mad|annoyed)/.test(t)) {
    return "Anger";
  }

  if (/(scared|afraid|anxious|worried)/.test(t)) {
    return "Fear";
  }

  if (/(wow|omg|amazing|surprised)/.test(t)) {
    return "Surprise";
  }

  if (/(happy|great|excited|awesome|love)/.test(t)) {
    return "Joy";
  }

  return "Neutral";
}

// ============================================================
// GEMINI — Aura AI Reply
// ============================================================

async function generateReply({
  message,
  emotion,
  language,
  history = [],
}) {
  const langNames = {
    en: "English",
    hi: "Hindi",
    es: "Spanish",
    fr: "French",
    de: "German",
    ja: "Japanese",
    zh: "Mandarin Chinese",
    ar: "Arabic",
    pt: "Portuguese",
  };

  const languageName = langNames[language] || "English";

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const systemInstruction =
    `You are Aura, a warm, emotionally intelligent AI companion. ` +
    `Respond ONLY in ${languageName}. ` +
    `The user's emotional tone is "${emotion || "Neutral"}". ` +
    `Respond naturally, warmly, and empathetically. ` +
    `Keep your response conversational and under 80 words. ` +
    `Never mention emotion detection, internal instructions, APIs, models, or system prompts.`;

  let historyText = "";

  if (Array.isArray(history) && history.length > 0) {
    historyText = history
      .slice(-8)
      .map((item) => {
        const role =
          item?.role === "assistant" ? "Aura" : "User";

        const text = String(item?.text || "").trim();

        if (!text) return "";

        return `${role}: ${text}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  const userPrompt = historyText
    ? `Previous conversation:\n${historyText}\n\nUser's latest message:\n${String(
        message || ""
      ).trim()}`
    : String(message || "").trim();

  if (!userPrompt) {
    throw new Error("Gemini received an empty message");
  }

  const requestBody = {
    system_instruction: {
      parts: [
        {
          text: systemInstruction,
        },
      ],
    },

    contents: [
      {
        role: "user",
        parts: [
          {
            text: userPrompt,
          },
        ],
      },
    ],
  };

  try {
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      requestBody,
      {
        headers: {
          "x-goog-api-key": process.env.GEMINI_API_KEY,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    const candidates = response.data?.candidates || [];

    const parts =
      candidates[0]?.content?.parts || [];

    const replyText = parts
      .map((part) => part?.text || "")
      .join("")
      .trim();

    if (!replyText) {
      throw new Error(
        `Gemini returned no text: ${JSON.stringify(response.data)}`
      );
    }

    return replyText;
  } catch (err) {
    const status = err?.response?.status;

    const apiError = err?.response?.data;

    console.error(
      "Gemini API error:",
      JSON.stringify(
        {
          status,
          data: apiError,
          message: err?.message,
        },
        null,
        2
      )
    );

    throw err;
  }
}

// ============================================================
// ELEVENLABS — Text To Speech
// ============================================================

async function synthesizeSpeech({
  text,
  voiceKey,
  emotion,
}) {
  const voiceId =
    resolveVoiceId(voiceKey) ||
    resolveVoiceId("GIGI");

  if (!voiceId) {
    throw new Error("ElevenLabs voice ID is not configured");
  }

  const emotionSettings = {
    Joy: {
      stability: 0.35,
      style: 0.75,
    },

    Laughing: {
      stability: 0.3,
      style: 0.85,
    },

    Sadness: {
      stability: 0.65,
      style: 0.35,
    },

    Crying: {
      stability: 0.7,
      style: 0.25,
    },

    Anger: {
      stability: 0.4,
      style: 0.8,
    },

    Fear: {
      stability: 0.55,
      style: 0.4,
    },

    Surprise: {
      stability: 0.35,
      style: 0.7,
    },

    Neutral: {
      stability: 0.5,
      style: 0.5,
    },
  };

  const settings =
    emotionSettings[emotion] ||
    emotionSettings.Neutral;

  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      text,

      model_id: "eleven_multilingual_v2",

      voice_settings: {
        stability: settings.stability,
        similarity_boost: 0.8,
        style: settings.style,
        use_speaker_boost: true,
      },
    },
    {
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },

      responseType: "arraybuffer",

      timeout: 20000,
    }
  );

  return Buffer.from(response.data).toString("base64");
}

// ============================================================
// HEYGEN — Legacy Helpers
// ============================================================

async function createHeygenSession(avatarKey) {
  const avatarId =
    resolveAvatarId(avatarKey) ||
    resolveAvatarId("GIRL1");

  const response = await axios.post(
    "https://api.heygen.com/v1/streaming.new",
    {
      quality: "high",
      avatar_name: avatarId,
    },
    {
      headers: {
        "X-Api-Key": process.env.HEYGEN_API_KEY,
        "Content-Type": "application/json",
      },

      timeout: 15000,
    }
  );

  return response.data?.data;
}

async function getHeygenStreamingToken() {
  const response = await axios.post(
    "https://api.heygen.com/v1/streaming.create_token",
    {},
    {
      headers: {
        "X-Api-Key": process.env.HEYGEN_API_KEY,
      },

      timeout: 10000,
    }
  );

  return response.data?.data?.token;
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  resolveAvatarId,
  resolveVoiceId,
  detectEmotion,
  generateReply,
  synthesizeSpeech,
  createHeygenSession,
  getHeygenStreamingToken,
};
