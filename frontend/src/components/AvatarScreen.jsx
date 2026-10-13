import React, { useEffect, useRef, useState } from "react";

const LABELS = { happy:"😊 Happy", joy:"😊 Happy", laughing:"😄 Happy", sad:"😔 Sad", sadness:"😔 Sad", crying:"😢 Crying", angry:"😠 Angry", anger:"😠 Angry", surprised:"😲 Surprised", surprise:"😲 Surprised", thinking:"🤔 Thinking", fear:"😟 Concerned", neutral:"🙂 Neutral", idle:"🙂 Neutral" };
function clipFor(value) {
  const e = String(value || "neutral").toLowerCase();
  if (/cry|tear|heartbreak|devastat/.test(e)) return "crying";
  if (/sad|grief|disappoint|negative|unhappy|down/.test(e)) return "sad";
  if (/ang|mad|frustrat|rage|irritat|bad/.test(e)) return "angry";
  if (/surpris|shock|amaz|astonish/.test(e)) return "surprised";
  if (/joy|laugh|happy|excite|love|grateful|positive|good|delight|cheer/.test(e)) return "happy";
  if (/fear|worr|anx|think|confus|curious|uncertain|contemplat/.test(e)) return "thinking";
  return "idle";
}
const src = (name) => "/videos/aura-" + name + ".mp4";
export default function AvatarScreen({ pendingSpeech, onSpeechConsumed, thinking = false }) {
  const videos = [useRef(null), useRef(null)];
  const [active, setActive] = useState(0);
  const [clip, setClip] = useState("idle");
  const [emotionLabel, setEmotionLabel] = useState("Neutral");
  const [sources, setSources] = useState([src("idle"), src("happy")]);
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
    setSources((old) => old.map((s, i) => i === inactive ? src(next) : s));
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
      if (i === active) el.play().catch(() => {});
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
    const next = clipFor(pendingSpeech.emotion);
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
      {videos.map((ref, i) => <video key={i} ref={ref} src={sources[i]} autoPlay loop muted playsInline preload="auto" aria-hidden="true" className="aura-emotion-video absolute inset-0 h-full w-full object-cover" style={{ opacity: active === i ? 1 : 0, transition: "opacity 180ms ease-in-out", zIndex: active === i ? 2 : 1 }} onError={() => { if (i === active && clip !== "idle") switchClip("idle"); }} />)}
      <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full bg-black/65 px-3 py-1 text-xs text-white backdrop-blur"><span className="h-2 w-2 rounded-full bg-teal-300" />{thinking ? "🤔 Thinking" : (LABELS[clip] || emotionLabel)}</div>
    </div>
  );
}
