const LANGUAGE_CODES = {
  hi: "hi-IN", en: "en-US", bn: "bn-IN", ta: "ta-IN",
  te: "te-IN", mr: "mr-IN", gu: "gu-IN", pa: "pa-IN",
  ur: "ur-IN", kn: "kn-IN", ml: "ml-IN", or: "or-IN",
};

function detectLanguage(text, fallbackLanguage = "en") {
  const value = String(text || "");
  if (/[ऀ-ॿ]/.test(value)) return "hi";
  if (/[ঀ-৿]/.test(value)) return "bn";
  if (/[஀-௿]/.test(value)) return "ta";
  if (/[ఀ-౿]/.test(value)) return "te";
  if (/[਀-੿]/.test(value)) return "pa";
  if (/[઀-૿]/.test(value)) return "gu";
  if (/[ಀ-೿]/.test(value)) return "kn";
  if (/[ഀ-ൿ]/.test(value)) return "ml";
  if (/[଀-୿]/.test(value)) return "or";
  // Latin-script Hindi/Hinglish cannot be identified reliably from script alone.
  return String(fallbackLanguage || "en").split("-")[0].toLowerCase();
}

function voiceScore(voice, language, preference) {
  const name = String(voice?.name || "").toLowerCase();
  const lang = String(voice?.lang || "").toLowerCase();
  let score = lang.startsWith(language.toLowerCase()) ? 30 : 0;
  const feminine = ["female", "woman", "girl", "gigi", "matilda", "samantha", "zira", "aria", "jenny", "heera", "veena", "lekha", "priya", "aditi", "google हिन्दी", "google hindi"];
  const masculine = ["male", "man", "adam", "david", "mark"];
  if (preference === "ADAM") {
    if (masculine.some((word) => name.includes(word))) score += 18;
    if (feminine.some((word) => name.includes(word))) score -= 12;
  } else {
    if (feminine.some((word) => name.includes(word))) score += 20;
    if (masculine.some((word) => name.includes(word))) score -= 8;
    if (preference === "GIGI" && name.includes("gigi")) score += 8;
    if (preference === "MATILDA" && name.includes("matilda")) score += 8;
  }
  if (voice?.localService) score += 2;
  return score;
}

/**
 * Uses only voices already available in the user's browser/device.
 * No paid API, API key, or per-character charge is used.
 * Actual voice quality and language availability depend on the device.
 */
export function speakAuraText(text, { language = "en", voice = "GIGI" } = {}) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return false;

  try {
    const synthesis = window.speechSynthesis;
    synthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text));
    const detected = detectLanguage(text, language);
    utterance.lang = LANGUAGE_CODES[detected] || (language || "en-US");
    utterance.rate = detected === "hi" ? 0.94 : 0.96;
    utterance.pitch = voice === "ADAM" ? 0.98 : 1.12;
    utterance.volume = 1;

    const chooseVoice = () => {
      const voices = synthesis.getVoices();
      if (!voices.length) return false;
      const matching = voices
        .map((candidate) => ({ candidate, score: voiceScore(candidate, detected, voice) }))
        .sort((a, b) => b.score - a.score);
      const best = matching[0];
      if (best && best.score > 0) utterance.voice = best.candidate;
      return true;
    };

    // Some browsers load their voice list asynchronously.
    if (!chooseVoice()) {
      const onVoicesChanged = () => {
        synthesis.removeEventListener?.("voiceschanged", onVoicesChanged);
        chooseVoice();
        synthesis.speak(utterance);
      };
      synthesis.addEventListener?.("voiceschanged", onVoicesChanged, { once: true });
      // If voiceschanged never fires, still speak with the device default.
      window.setTimeout(() => {
        synthesis.removeEventListener?.("voiceschanged", onVoicesChanged);
        if (utterance.voice || synthesis.speaking) return;
        synthesis.speak(utterance);
      }, 1200);
      return true;
    }

    synthesis.speak(utterance);
    return true;
  } catch (error) {
    console.warn("Aura browser voice playback unavailable:", error);
    return false;
  }
}
