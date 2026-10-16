import React, { useEffect, useRef, useState } from "react";

const LABELS = { happy:"😊 Happy", joy:"😊 Happy", laughing:"😄 Happy", sad:"😔 Sad", sadness:"😔 Sad", crying:"😢 Crying", angry:"😠 Angry", anger:"😠 Angry", surprised:"😲 Surprised", surprise:"😲 Surprised", thinking:"🤔 Thinking", fear:"😟 Concerned", neutral:"🙂 Neutral", idle:"🙂 Neutral" };
function clipFor(value, replyText = "") {
  const e = String(value || "").toLowerCase();
  const t = String(replyText || "").toLowerCase();
  const combined = e + " " + t;
  if (/(\b(cry|crying|sob|sobbing|weep|tears|😭|boo.?hoo)\b|रो|रोना|रो रही|रो रहा|आंसू|आँसू|दुखी|उदास)/i.test(combined)) return "crying";
  if (/(\b(laugh|laughing|giggle|giggles|chuckle|haha|hahaha|lol|😂|🤣|funny|hilarious)\b|हंस|हँस|मजाक|खुश|हँसी|हंसी)/i.test(combined)) return "happy";
  if (/(\b(shock|shocked|shocking|surpris|surprised|surprising|astonish|astonished|unbelievable|wow|omg|😲|😱)\b|हैरान|चौंक|आश्चर्य|अविश्वास)/i.test(combined)) return "surprised";
  if (/(\b(angry|anger|furious|mad|rage|annoyed|frustrated|irritated|😠|🤬)\b|गुस्सा|नाराज|नाराज़|क्रोधित)/i.test(combined)) return "angry";
  if (/(\b(sad|sadness|heartbroken|grief|disappointed|unhappy|lonely|hurt|😔|💔)\b|दुखी|उदास|अकेला|अकेली|दर्द)/i.test(combined)) return "sad";
  if (/\b(happy|happiness|joy|joyful|excited|delighted|glad|love|lovely|proud|grateful|😊|😄|🥰)\b/.test(combined)) return "happy";
  if (/\b(fear|worried|worry|anxious|afraid|scared|concerned|😟)\b|चिंता|डर|घबर/i.test(combined)) return "fear";
  // No clear emotion in the text? Keep the current expression instead of resetting to neutral.
  return null;
}
const src = (name) => "/videos/aura-" + name + ".mp4";
const githubSrc = (name) => "https://raw.githubusercontent.com/kumariswati18088-wq/emotional-intelligence-ai/main/frontend/public/videos/aura-" + name + ".mp4";

export default function AvatarScreen({ pendingSpeech, onSpeechConsumed, thinking = false }) {
  const videos = [useRef(null), useRef(null)];
  const [active, setActive] = useState(0);
  const [clip, setClip] = useState("idle");
  const [emotionLabel, setEmotionLabel] = useState("Neutral");
  const busyRef = useRef(false);
  const targetRef = useRef("idle");
  const lastSpeechRef = useRef(null);
  const thinkingRef = useRef(false);

  const switchClip = (next) => {
    if (!next || next === targetRef.current) return;
    targetRef.current = next;
    const inactive = 1 - active;
    const el = videos[inactive].current;
    if (!el) { setClip(next); return; }
    busyRef.current = true;
    const reveal = () => {
      el.removeEventListener("canplay", reveal);
      el.play().catch(() => {});
      setActive(inactive);
      setClip(next);
      busyRef.current = false;
    };
    el.addEventListener("canplay", reveal, { once: true });
    el.dataset.clip = next;
    el.dataset.githubFallback = "0";
    el.src = src(next);
    el.load();
    if (el.readyState >= 3) reveal();
    window.setTimeout(() => {
      if (busyRef.current && targetRef.current === next && el.readyState >= 2) reveal();
    }, 900);
  };

  useEffect(() => {
    videos.forEach((ref, i) => {
      const el = ref.current;
      if (!el) return;
      el.muted = true;
      if (!el.getAttribute("src")) {
        const initialClip = i === 0 ? "idle" : "happy";
        el.dataset.clip = initialClip;
        el.dataset.githubFallback = "0";
        el.src = src(initialClip);
        el.load();
      }
      if (i === active) el.play().catch(() => {});
    });
  }, []);

  // Thinking remains a temporary, separate mode. It returns to the last expression afterward.
  useEffect(() => {
    thinkingRef.current = thinking;
    if (thinking) {
      switchClip("thinking");
      setEmotionLabel("Thinking");
    } else if (targetRef.current === "thinking") {
      const previous = lastSpeechRef.current?.clip || "idle";
      switchClip(previous);
      setEmotionLabel(LABELS[previous] || "Neutral");
    }
  }, [thinking]);

  useEffect(() => {
    if (!pendingSpeech?.text || lastSpeechRef.current?.id === pendingSpeech.id) return;
    const detected = clipFor(pendingSpeech.emotion, pendingSpeech.text);
    const next = detected || lastSpeechRef.current?.clip || (targetRef.current === "thinking" ? "idle" : targetRef.current);
    lastSpeechRef.current = { id: pendingSpeech.id || pendingSpeech, clip: next };
    setEmotionLabel(LABELS[next] || "Neutral");
    if (!thinkingRef.current) switchClip(next);
    onSpeechConsumed?.();
  }, [pendingSpeech, onSpeechConsumed]);

  return (
    <div className="relative aura-video-frame mx-auto w-full overflow-hidden rounded-3xl border border-white/10 bg-midnight-900 shadow-glow">
      {videos.map((ref, i) => <video key={i} ref={ref} autoPlay loop muted playsInline preload="auto" aria-hidden="true" className="aura-emotion-video absolute inset-0 h-full w-full object-cover" style={{ opacity: active === i ? 1 : 0, transition: "opacity 180ms ease-in-out", zIndex: active === i ? 2 : 1 }} onTimeUpdate={(event) => { const el = event.currentTarget; const name = el.dataset.clip || clip; if (name && !["idle", "neutral", "thinking"].includes(name) && Number.isFinite(el.duration) && el.duration > 2 && el.currentTime >= el.duration * 0.68) { el.currentTime = 0; el.play().catch(() => {}); } }} onError={(event) => { const el = event.currentTarget; const name = el.dataset.clip || clip || "idle"; if (el.dataset.githubFallback !== "1") { el.dataset.githubFallback = "1"; el.src = githubSrc(name); el.load(); el.play().catch(() => {}); } }} />)}
      <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full bg-black/65 px-3 py-1 text-xs text-white backdrop-blur"><span className="h-2 w-2 rounded-full bg-teal-300" />{thinking ? "🤔 Thinking" : (LABELS[clip] || emotionLabel)}</div>
    </div>
  );
}
