import React, { useEffect, useRef, useState } from "react";

const LABELS = { happy:"😊 Happy", joy:"😊 Happy", laughing:"😄 Happy", sad:"😔 Sad", sadness:"😔 Sad", crying:"😢 Crying", angry:"😠 Angry", anger:"😠 Angry", surprised:"😲 Surprised", surprise:"😲 Surprised", thinking:"🤔 Thinking", fear:"😟 Concerned", neutral:"🙂 Neutral", idle:"🙂 Neutral" };
function clipFor(value, replyText = "") {
  const e = String(value || "").toLowerCase();
  const t = String(replyText || "").toLowerCase();
  const combined = e + " " + t;
  // Explicit requests and even subtle emotional wording should immediately drive the avatar.
  if (/(\b(cry|crying|sob|sobbing|weep|tears|😭|boo.?hoo|uh.?uh)\b|रो|रोना|रो रही|रो रहा|आंसू|आँसू|दुखी|उदास)/i.test(combined)) return "crying";
  if (/(\b(laugh|laughing|giggle|giggles|chuckle|haha|hahaha|lol|😂|🤣|funny|hilarious)\b|हंस|हँस|मजाक|खुश|हँसी|हंसी)/i.test(combined)) return "happy";
  if (/(\b(shock|shocked|shocking|surpris|surprised|surprising|astonish|astonished|unbelievable|wow|omg|😲|😱)\b|हैरान|चौंक|आश्चर्य|अविश्वास)/i.test(combined)) return "surprised";
  if (/(\b(angry|anger|furious|mad|rage|annoyed|frustrated|irritated|😠|🤬)\b|गुस्सा|नाराज|नाराज़|क्रोधित)/i.test(combined)) return "angry";
  if (/(\b(sad|sadness|heartbroken|grief|disappointed|unhappy|lonely|hurt|😔|💔)\b|दुखी|उदास|अकेला|अकेली|दर्द)/i.test(combined)) return "sad";
  if (/\b(happy|happiness|joy|joyful|excited|delighted|glad|love|lovely|proud|grateful|😊|😄|🥰)\b/.test(combined)) return "happy";
  const e2 = combined;
  if (/cry|tear|heartbreak|devastat|sobb/.test(e2)) return "crying";
  if (/sad|grief|disappoint|negative|unhappy|down/.test(e2)) return "sad";
  if (/ang|mad|frustrat|rage|irritat|bad/.test(e2)) return "angry";
  if (/surpris|shock|amaz|astonish/.test(e2)) return "surprised";
  if (/joy|laugh|happy|excite|love|grateful|positive|good|delight|cheer/.test(e2)) return "happy";
  if (/fear|worr|anx|think|confus|curious|uncertain|contemplat/.test(e2)) return "thinking";
  return "idle";
}
const src = (name) => "/videos/aura-" + name + ".mp4";
export default function AvatarScreen({ pendingSpeech, onSpeechConsumed, thinking = false }) {
  const videos = [useRef(null), useRef(null)];
  const [active, setActive] = useState(0);
  const [clip, setClip] = useState("idle");
  const [emotionLabel, setEmotionLabel] = useState("Neutral");

  const busyRef = useRef(false);
  const targetRef = useRef("idle");
  const lastSpeechRef = useRef(null);
  const timerRef = useRef(null);

  // Two permanently mounted video layers: prepare the next MP4 before revealing it.
  // This prevents a black/blank frame when changing emotion clips.
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
    el.src = src(next);
    el.load();
    if (el.readyState >= 3) reveal();
    window.setTimeout(() => {
      if (busyRef.current && targetRef.current === next) {
        if (el.readyState >= 2) reveal();
      }
    }, 900);
  };

  useEffect(() => {
    videos.forEach((ref, i) => {
      const el = ref.current;
      if (!el) return;
      el.muted = true;
      // Keep both video layers mounted and preloaded so the next emotion is ready off-screen.
      if (!el.getAttribute("src")) { el.src = src(i === 0 ? "idle" : "happy"); el.load(); }
      if (i === active) { el.play().catch(() => {}); }
    });
  }, []);

  useEffect(() => {
    if (thinking) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setEmotionLabel("Thinking");
      switchClip("thinking");
    }
  }, [thinking]);

  useEffect(() => {
    if (!pendingSpeech?.text || lastSpeechRef.current === pendingSpeech) return;
    lastSpeechRef.current = pendingSpeech;
    const next = clipFor(pendingSpeech.emotion, pendingSpeech.text);
    setEmotionLabel(LABELS[next] || next);
    switchClip(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (!thinking) { switchClip("idle"); setEmotionLabel("Neutral"); }
    }, Math.max(4500, Math.min(12000, String(pendingSpeech.text).length * 65)));
    onSpeechConsumed?.();
  }, [pendingSpeech, onSpeechConsumed]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  return (
    <div className="relative aura-video-frame mx-auto w-full overflow-hidden rounded-3xl border border-white/10 bg-midnight-900 shadow-glow">
      {videos.map((ref, i) => <video key={i} ref={ref} autoPlay loop muted playsInline preload="auto" aria-hidden="true" className="aura-emotion-video absolute inset-0 h-full w-full object-cover" style={{ opacity: active === i ? 1 : 0, transition: "opacity 180ms ease-in-out", zIndex: active === i ? 2 : 1 }} onError={() => { if (i === active && clip !== "idle") switchClip("idle"); }} />)}
      <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full bg-black/65 px-3 py-1 text-xs text-white backdrop-blur"><span className="h-2 w-2 rounded-full bg-teal-300" />{thinking ? "🤔 Thinking" : (LABELS[clip] || emotionLabel)}</div>
    </div>
  );
}
