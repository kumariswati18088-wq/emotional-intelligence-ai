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

// --- Step 1: Hume AI — emotional state extraction from text ---
// Uses Hume's language-emotion endpoint. Falls back to a small keyword
// heuristic if the API is unreachable, so the pipeline degrades
// gracefully instead of failing the whole request.
async function detectEmotion(text) {
  try {
    const response = await axios.post(
      "https://api.hume.ai/v0/batch/jobs",
      {
        models: { language: {} },
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
    // Hume's batch API is async (job-based); for real-time chat, prefer
    // Hume's streaming/expression-measurement WS API in production.
    // Here we read a synchronous-style prediction shape if present,
    // otherwise fall through to the heuristic below.
    const predictions = response.data?.predictions;
    if (predictions?.length) {
      const top = predictions[0]?.emotions?.sort((a, b) => b.score - a.score)[0];
      if (top?.name) return normalizeEmotion(top.name);
    }
    return heuristicEmotion(text);
  } catch (err) {
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
  const key = rawName.toLowerCase();
  return map[key] || rawName;
}

function heuristicEmotion(text) {
  const t = text.toLowerCase();
  if (/(haha|lol|lmao|funny|hilarious)/.test(t)) return "Laughing";
  if (/(sad|depressed|down|hurt|lonely|cry)/.test(t)) return "Sadness";
  if (/(crying|sobbing|tears)/.test(t)) return "Crying";
  if (/(angry|furious|mad|annoyed)/.test(t)) return "Anger";
  if (/(scared|afraid|anxious|worried)/.test(t)) return "Fear";
  if (/(wow|omg|amazing|surprised)/.test(t)) return "Surprise";
  if (/(happy|great|excited|awesome|love)/.test(t)) return "Joy";
  return "Neutral";
}

// --- Step 2: Gemini — generate the reply text in the target language ---
async function generateReply({ message, emotion, language, history = [] }) {
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

  const systemInstruction = {
    parts: [
      {
        text:
          `You are Aura, a warm, emotionally intelligent AI companion. ` +
          `Respond ONLY in ${languageName}. The user's detected emotional tone is "${emotion}". ` +
          `Reply with empathy that matches that tone, keep responses conversational and under 80 words, ` +
          `and never mention that you detected an emotion — just respond naturally in a way that reflects it.`,
      },
    ],
  };

  const contents = [
    ...history.slice(-10).map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.text }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    { contents, systemInstruction },
    { headers: { "Content-Type": "application/json" }, timeout: 15000 }
  );

  const text =
    response.data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ||
    "I'm here with you.";
  return text.trim();
}

// --- Step 3: ElevenLabs — synthesize emotional speech ---
async function synthesizeSpeech({ text, voiceKey, emotion }) {
  const voiceId = resolveVoiceId(voiceKey) || resolveVoiceId("GIGI");

  // Map emotion to voice-setting nudges (stability/style) so delivery
  // shifts with the detected tone.
  const emotionSettings = {
    Joy: { stability: 0.35, style: 0.75 },
    Laughing: { stability: 0.3, style: 0.85 },
    Sadness: { stability: 0.65, style: 0.35 },
    Crying: { stability: 0.7, style: 0.25 },
    Anger: { stability: 0.4, style: 0.8 },
    Fear: { stability: 0.55, style: 0.4 },
    Surprise: { stability: 0.35, style: 0.7 },
    Neutral: { stability: 0.5, style: 0.5 },
  };
  const settings = emotionSettings[emotion] || emotionSettings.Neutral;

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

// --- Step 4: HeyGen — streaming avatar session management ---
async function createHeygenSession(avatarKey) {
  const avatarId = resolveAvatarId(avatarKey) || resolveAvatarId("GIRL1");

  const response = await axios.post(
    "https://api.heygen.com/v1/streaming.new",
    { quality: "high", avatar_name: avatarId },
    {
      headers: {
        "X-Api-Key": process.env.HEYGEN_API_KEY,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    }
  );
  return response.data?.data; // { session_id, url, access_token, ... }
}

async function getHeygenStreamingToken() {
  const response = await axios.post(
    "https://api.heygen.com/v1/streaming.create_token",
    {},
    {
      headers: { "X-Api-Key": process.env.HEYGEN_API_KEY },
      timeout: 10000,
    }
  );
  return response.data?.data?.token;
}

module.exports = {
  resolveAvatarId,
  resolveVoiceId,
  detectEmotion,
  generateReply,
  synthesizeSpeech,
  createHeygenSession,
  getHeygenStreamingToken,
};
