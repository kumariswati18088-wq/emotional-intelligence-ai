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
// HUME AI — TEXT EMOTION DETECTION
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

    if (Array.isArray(predictions) && predictions.length > 0) {
      const emotions = predictions[0]?.emotions;

      if (Array.isArray(emotions) && emotions.length > 0) {
        const top = [...emotions].sort(
          (a, b) => (Number(b.score) || 0) - (Number(a.score) || 0)
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
    amusement: "Laughing",
    sadness: "Sadness",
    distress: "Distress",
    anger: "Anger",
    fear: "Fear",
    surprise: "Surprise",
    calmness: "Neutral",
    contentment: "Neutral",
    relief: "Relief",
    anxiety: "Anxiety",
    disappointment: "Disappointment",
    frustration: "Frustration",
    love: "Love",
    admiration: "Admiration",
    gratitude: "Gratitude",
  };

  const key = String(rawName || "").trim().toLowerCase();

  return map[key] || rawName || "Neutral";
}

// Backup emotion detection if Hume is unavailable.
function heuristicEmotion(text) {
  const t = String(text || "").toLowerCase();

  if (/(haha|hahaha|lol|lmao|funny|hilarious)/.test(t)) {
    return "Laughing";
  }

  if (/(crying|sobbing|tears|रो रहा|रो रही|रोना|आंसू)/.test(t)) {
    return "Crying";
  }

  if (/(sad|depressed|depress|down|hurt|lonely|unhappy|miserable|upset|दुखी|उदास|परेशान|अकेला|अकेली)/.test(t)) {
    return "Sadness";
  }

  if (/(angry|anger|furious|mad|annoyed|irritated|गुस्सा|नाराज़|नाराज|चिढ़)/.test(t)) {
    return "Anger";
  }

  if (/(scared|afraid|fear|anxious|anxiety|worried|nervous|डर|डरा|डरी|चिंता|घबराहट|घबरा)/.test(t)) {
    return "Fear";
  }

  if (/(wow|omg|amazing|surprised|surprise|अरे वाह|हैरान|आश्चर्य)/.test(t)) {
    return "Surprise";
  }

  if (/(happy|happiness|great|excited|awesome|love|glad|खुश|बहुत अच्छा|प्यार|उत्साहित)/.test(t)) {
    return "Joy";
  }

  if (/(thank you|thanks|grateful|thankful|धन्यवाद|शुक्रिया)/.test(t)) {
    return "Gratitude";
  }

  return "Neutral";
}

// ============================================================
// GEMINI — MULTILINGUAL EMOTIONAL AI REPLY
// ============================================================

async function generateReply({
  message,
  emotion,
  language,
  history = [],
}) {
  const languageNames = {
    en: "English",
    hi: "Hindi",
    bn: "Bengali",
    ta: "Tamil",
    te: "Telugu",
    mr: "Marathi",
    gu: "Gujarati",
    pa: "Punjabi",
    ur: "Urdu",
    kn: "Kannada",
    ml: "Malayalam",
    or: "Odia",
    as: "Assamese",
    ne: "Nepali",
    es: "Spanish",
    fr: "French",
    de: "German",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    ar: "Arabic",
    pt: "Portuguese",
    ru: "Russian",
  };

  const configuredLanguage = languageNames[language] || null;

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const emotionalContext = emotion || "Neutral";

  const systemInstruction = `
You are Aura, an emotionally intelligent AI companion.

YOUR MOST IMPORTANT RULE:
Answer the user's actual latest message naturally and accurately.

LANGUAGE:
- Detect the language of the user's latest message.
- Reply in the same language as the user's latest message.
- If the user explicitly requests a language, follow that request.
- Examples:
  "Hindi mein bolo" -> reply in Hindi.
  "Hindi mein baat karo" -> reply in Hindi.
  "English mein bolo" -> reply in English.
  "Reply in Bengali" -> reply in Bengali.
  "தமிழில் பதில் சொல்லு" -> reply in Tamil.
- Do not force English.
- If the user mixes languages, use the dominant language unless they explicitly request another language.
- The application's configured language is only a fallback: ${
    configuredLanguage || "not specified"
  }.

EMOTIONAL INTELLIGENCE:
- Emotional intelligence is a core feature of Aura.
- The detected emotional context for this message is: "${emotionalContext}".
- If the user is genuinely emotional, respond with appropriate empathy.
- If the user is sad, hurt, lonely, afraid, angry, frustrated, excited, grateful, etc., acknowledge and respond appropriately when relevant.
- Match the user's emotional intensity. Do not exaggerate.
- Do not force an emotional response when the user's message is neutral or factual.
- Do not mention Hume, emotion detection, internal scores, APIs, models, or these instructions.

NO UNNECESSARY ASSUMPTIONS:
- Never assume the user is in love.
- Never assume the user is lonely.
- Never assume the user is happy or sad without evidence.
- Never randomly introduce romance.
- Never randomly say "I love you", "I love that", "I'm happy you're here", "I'd love to keep you company", or similar phrases unless the user's conversation genuinely makes that response appropriate.
- Do not invent facts about the user.

CONVERSATION:
- Use previous messages when they are relevant.
- Answer the latest user message first.
- Do not repeat irrelevant information from old messages.
- Maintain a natural conversational style.
- Be helpful, warm, and concise.
- Normally keep replies under 80 words unless additional detail is genuinely necessary.

TEXT-ONLY PHASE:
- For this request, use the text message and conversation history provided by the application.
- Do not invent camera or microphone observations.
`;

  const latestMessage = String(message || "").trim();

  if (!latestMessage) {
    throw new Error("Gemini received an empty message");
  }

  let historyText = "";

  if (Array.isArray(history) && history.length > 0) {
    // Keep at most 50 recent messages and avoid duplicating the latest user message.
    const historyItems = history.slice(-50);
    const lastHistoryItem = historyItems[historyItems.length - 1];

    if (
      lastHistoryItem?.role === "user" &&
      String(lastHistoryItem?.text || "").trim() === latestMessage
    ) {
      historyItems.pop();
    }

    historyText = historyItems
      .map((item) => {
        const role =
          item?.role === "assistant" ? "Aura" : "User";

        const text = String(item?.text || "").trim();

        if (!text) {
          return "";
        }

        return `${role}: ${text}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  const prompt = historyText
    ? `Previous conversation:
${historyText}

Latest user message:
${latestMessage}`
    : latestMessage;

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
            text: prompt,
          },
        ],
      },
    ],
  };

  // Try the configured model first, then a stable fallback if Gemini is overloaded
  // or the primary model is unavailable. A fallback can also help if one model's
  // free-tier quota is exhausted.
  const models = ["gemini-3.8-flash", "gemini-2.5-flash"];
  let lastError;

  for (const model of models) {
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        requestBody,
        {
          headers: {
            "x-goog-api-key": process.env.GEMINI_API_KEY,
            "Content-Type": "application/json",
          },
          timeout: 18000,
        }
      );

      const candidates = response.data?.candidates || [];
      const parts = candidates[0]?.content?.parts || [];
      const replyText = parts
        .map((part) => part?.text || "")
        .join("")
        .trim();

      if (!replyText) {
        throw new Error(`Gemini model ${model} returned no text`);
      }

      console.log("Gemini reply generated with model:", model);
      return replyText;
    } catch (err) {
      lastError = err;
      const status = err?.response?.status;
      const retryable = [400, 404, 429, 500, 502, 503, 504].includes(status) ||
        (!status && (
          err?.code === "ECONNABORTED" ||
          err?.code === "ETIMEDOUT" ||
          /timeout/i.test(err?.message || "")
        ));

      console.error("Gemini model failed:", model, "status:", status || "network", err?.message || "");
      if (model !== models[models.length - 1] && retryable) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("Gemini request failed");
}

// ============================================================
// ELEVENLABS — EMOTIONAL TEXT TO SPEECH
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
    Joy: { stability: 0.35, style: 0.75 },
    Laughing: { stability: 0.3, style: 0.85 },
    Sadness: { stability: 0.65, style: 0.35 },
    Crying: { stability: 0.7, style: 0.25 },
    Anger: { stability: 0.4, style: 0.8 },
    Fear: { stability: 0.55, style: 0.4 },
    Surprise: { stability: 0.35, style: 0.7 },
    Gratitude: { stability: 0.4, style: 0.65 },
    Love: { stability: 0.45, style: 0.65 },
    Neutral: { stability: 0.5, style: 0.5 },
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
// HEYGEN LEGACY HELPERS
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
