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

    const headers = {
      "X-Hume-Api-Key": process.env.HUME_API_KEY,
      "Content-Type": "application/json",
    };

    // Hume Batch API is asynchronous: first create a job, then fetch its predictions.
    const submitted = await axios.post(
      "https://api.hume.ai/v0/batch/jobs",
      { models: { language: {} }, text: [text] },
      { headers, timeout: 5000 }
    );

    const jobId = submitted.data?.job_id;
    if (!jobId) {
      console.warn("Hume did not return a job_id; using local emotion fallback.");
      return heuristicEmotion(text);
    }

    // Allow a short processing window; never block chat for long on emotion detection.
    let predictionData = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
      try {
        const result = await axios.get(
          `https://api.hume.ai/v0/batch/jobs/${encodeURIComponent(jobId)}/predictions`,
          { headers, timeout: 2500 }
        );
        predictionData = result.data;
        if (predictionData) break;
      } catch (pollError) {
        const status = pollError?.response?.status;
        // A job may not be ready yet; retry briefly, but don't hide auth or other errors.
        if (status && status !== 404 && status !== 409) throw pollError;
      }
    }

    const foundEmotions = [];
    const visited = new Set();
    function collectEmotionArrays(value) {
      if (!value || typeof value !== "object" || visited.has(value)) return;
      visited.add(value);
      if (Array.isArray(value)) {
        if (value.length && value.some((item) => item && typeof item.name === "string" && Number.isFinite(Number(item.score)))) {
          foundEmotions.push(value);
        }
        for (const item of value) collectEmotionArrays(item);
        return;
      }
      for (const child of Object.values(value)) collectEmotionArrays(child);
    }
    collectEmotionArrays(predictionData);

    const emotions = foundEmotions[0];
    if (emotions?.length) {
      const top = [...emotions].sort(
        (a, b) => (Number(b.score) || 0) - (Number(a.score) || 0)
      )[0];
      if (top?.name) return normalizeEmotion(top.name);
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
  attachments = [],
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

LANGUAGE — PERSISTENT CONVERSATION PREFERENCE:
- Detect the language of the user's latest message and any explicit language request.
- If the user explicitly asks to use a language, switch immediately and keep replying in that language for all future turns until they explicitly request another language or clearly begin speaking a different language.
- A short message such as "Hi" or "OK" does not reset the language preference; keep the most recently established language.
- If the latest message is too short to identify a language, use the most recent language established by the conversation history.
- If the user asks a question about a language (for example, "What is your name in Hindi?"), answer the entire response in that requested language, not just the translated word or phrase.
- For Hindi, use natural Hindi in Devanagari script for the whole response. Do not explain in English unless the user asks for English.
- Translate greetings, explanations, examples, and follow-up questions into the selected language. Keep proper names and technical terms as appropriate.
- If the user mixes languages without an explicit request, use the dominant language.
- The application's configured language is only a fallback: ${configuredLanguage || "not specified"}.

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
- For a simple greeting such as "Hi" or "Hello", greet the user naturally and briefly in the established reply language.
- Do not repeatedly ask how the user feels or repeat the same follow-up question across consecutive turns. If the assistant has already asked a question and the user only greets, acknowledge the greeting without pressuring them to answer the earlier question.
- Ask at most one relevant follow-up question, and only when it helps move the conversation forward.

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

  const contentParts = [{ text: prompt }];
  for (const attachment of (Array.isArray(attachments) ? attachments.slice(0, 5) : [])) {
    const mimeType = String(attachment?.type || "").toLowerCase();
    const name = String(attachment?.name || "uploaded file").slice(0, 180);
    const data = String(attachment?.data || "");
    if (!data) {
      contentParts.push({ text: "The user attached " + name + ", but its contents were not available to the AI." });
      continue;
    }
    if (mimeType.startsWith("image/") || mimeType.startsWith("video/") || mimeType === "application/pdf") {
      contentParts.push({ text: "User attachment: " + name });
      contentParts.push({ inline_data: { mime_type: mimeType, data } });
    } else if (mimeType.startsWith("text/") || /\.(txt|csv|json|md)$/i.test(name)) {
      try {
        const decoded = Buffer.from(data, "base64").toString("utf8").slice(0, 30000);
        contentParts.push({ text: "Text from attached file " + name + ":\n" + decoded });
      } catch {
        contentParts.push({ text: "The user attached " + name + ", but its text could not be decoded." });
      }
    } else {
      contentParts.push({ text: "The user attached " + name + " (" + mimeType + "). This file format is attached but its contents may not be readable by the current AI provider." });
    }
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
        parts: contentParts,
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
