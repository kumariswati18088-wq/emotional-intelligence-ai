import React, { useEffect, useRef, useState } from "react";

const LABELS = { happy:"😊 Happy", joy:"😊 Happy", laughing:"😄 Happy", sad:"😔 Sad", sadness:"😔 Sad", crying:"😢 Crying", angry:"😠 Angry", anger:"😠 Angry", surprised:"😲 Surprised", surprise:"😲 Surprised", thinking:"🤔 Thinking", fear:"😟 Concerned", neutral:"🙂 Neutral", idle:"🙂 Neutral" };
function clipFor(value) {
  const e = String(value || "neutral").toLowerCase();
  if (/cry|tear/.test(e)) return "crying";
  if (/sad|grief|disappoint/.test(e)) return "sad";
  if (/ang|mad|frustrat/.test(e)) return "angry";
  if (/surpris|shock|amaz/.test(e)) return "surprised";
  if (/joy|laugh|happy|excite|love|grateful/.test(e)) return "happy";
  if (/fear|worr|anx|think|confus/.test(e)) return "thinking";
  return "idle";
}
export default function AvatarScreen({ pendingSpeech, onSpeechConsumed }) {
  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const [clip, setClip] = useState("idle");
  const [emotionLabel, setEmotionLabel] = useState("Neutral");
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.load();
    const play = video.play();
    if (play && play.catch) play.catch(() => {});
  }, [clip]);
  useEffect(() => {
    if (!pendingSpeech || !pendingSpeech.text) return;
    const next = clipFor(pendingSpeech.emotion);
    setClip(next);
    setEmotionLabel(String(pendingSpeech.emotion || next).replace(/^./, c => c.toUpperCase()));
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => { setClip("idle"); setEmotionLabel("Neutral"); }, Math.max(4500, Math.min(12000, String(pendingSpeech.text).length * 65)));
    if (onSpeechConsumed) onSpeechConsumed();
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [pendingSpeech, onSpeechConsumed]);
  return (
    <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-midnight-900 shadow-glow">
      <video ref={videoRef} key={clip} src={"/videos/aura-" + clip + ".mp4"} autoPlay loop muted playsInline preload="auto" aria-label={"Aura " + clip + " animation"} className="absolute inset-0 h-full w-full object-cover" onError={() => { if (clip !== "idle") setClip("idle"); }} />
      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1 text-xs text-white backdrop-blur"><span className="h-2 w-2 rounded-full bg-teal-300" />{LABELS[String(clip).toLowerCase()] || emotionLabel}</div>
    </div>
  );
}
