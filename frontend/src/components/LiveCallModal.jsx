import React, { useEffect, useRef, useState } from "react";
import AvatarScreen from "./AvatarScreen";
import { api } from "../utils/api";

export default function LiveCallModal({ onClose, token, language, voice, avatar }) {
  const localVideoRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [facingMode, setFacingMode] = useState("user");
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [reply, setReply] = useState("Hi, I'm here with you. How are you feeling?");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [pendingSpeech, setPendingSpeech] = useState(null);

  useEffect(() => {
    startStream("user");
    return () => { stopStream(); recognitionRef.current?.stop?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startStream(mode) {
    try {
      stopStream();
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera/microphone require browser permission and a secure connection.");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: true });
      streamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setMicOn(stream.getAudioTracks().some((t) => t.enabled));
      setCamOn(stream.getVideoTracks().some((t) => t.enabled));
      setError("");
    } catch (err) {
      setError(err?.message || "Camera/microphone access unavailable. You can still type to Aura.");
    }
  }
  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }
  function toggleMic() {
    const tracks = streamRef.current?.getAudioTracks() || [];
    const next = !micOn;
    tracks.forEach((t) => { t.enabled = next; });
    setMicOn(next);
    if (!next) recognitionRef.current?.stop?.();
  }
  function toggleCam() {
    const tracks = streamRef.current?.getVideoTracks() || [];
    const next = !camOn;
    tracks.forEach((t) => { t.enabled = next; });
    setCamOn(next);
  }
  async function flipCamera() {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    await startStream(next);
  }
  function startVoiceInput() {
    setError("");
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("Voice typing is not supported in this browser. Try Chrome on Android, or type below."); return; }
    const recognition = new SR();
    recognition.lang = ({hi:"hi-IN",en:"en-US",bn:"bn-IN",ta:"ta-IN",te:"te-IN",mr:"mr-IN",gu:"gu-IN",pa:"pa-IN",ur:"ur-IN",kn:"kn-IN",ml:"ml-IN",or:"or-IN"})[language] || language || "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((r) => r[0]?.transcript || "").join(" ").trim();
      if (text) setInput(text);
    };
    recognition.onerror = (event) => setError(event.error === "not-allowed" ? "Please allow microphone access for voice typing." : "Voice typing stopped; please try again.");
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try { recognition.start(); setListening(true); } catch { setListening(false); setError("Could not start voice typing. Please try again."); }
  }
  async function sendMessage(event) {
    event?.preventDefault?.();
    const message = input.trim();
    if (!message || busy) return;
    setBusy(true);
    setReply("Aura is thinking…");
    setInput("");
    try {
      const result = await api.sendChat(token, { message, language, voice, history: [{ role: "assistant", text: reply }, { role: "user", text: message }] });
      const text = result?.reply || "I couldn't generate a response. Please try again.";
      setReply(text);
      const payload = { text, emotion: result?.emotion || "Neutral", audio: result?.audio || null };
      setPendingSpeech(payload);
      if (!result?.audio && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const languageCodes = {hi:"hi-IN",en:"en-US",bn:"bn-IN",ta:"ta-IN",te:"te-IN",mr:"mr-IN",gu:"gu-IN",pa:"pa-IN",ur:"ur-IN",kn:"kn-IN",ml:"ml-IN",or:"or-IN"};
        const spokenLanguage = /[ऀ-ॿ]/.test(text) ? "hi" : /[ঀ-৿]/.test(text) ? "bn" : /[஀-௿]/.test(text) ? "ta" : /[ఀ-౿]/.test(text) ? "te" : /[਀-੿]/.test(text) ? "pa" : /[઀-૿]/.test(text) ? "gu" : /[ಀ-೿]/.test(text) ? "kn" : /[ഀ-ൿ]/.test(text) ? "ml" : /[଀-୿]/.test(text) ? "or" : (language || "en");
        utterance.lang = languageCodes[spokenLanguage] || spokenLanguage || "en-US";
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      setReply("Sorry, I couldn't get a response: " + (err?.message || "Please try again."));
    } finally { setBusy(false); }
  }
  function handleClose() {
    stopStream();
    recognitionRef.current?.stop?.();
    window.speechSynthesis?.cancel?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#070710] text-white flex items-center justify-center p-3 sm:p-6">
      <div className="relative flex h-[min(96dvh,960px)] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-midnight-950 shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
          <div><p className="font-semibold">Aura Live</p><p className="text-xs text-white/50">Live conversation</p></div>
          <button onClick={handleClose} className="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10">Close ✕</button>
        </header>
        <div className="relative min-h-0 flex-1 overflow-y-auto p-3 pb-5 sm:p-6">
          <div className="mx-auto w-full max-w-md pt-28 sm:pt-36">
            <AvatarScreen token={token} avatar={avatar} pendingSpeech={pendingSpeech} onSpeechConsumed={() => setPendingSpeech(null)} />
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="mb-2 text-xs uppercase tracking-wider text-teal-200/80">Aura's reply</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{reply}</p>
              {busy && <p className="mt-2 text-xs text-white/50">Preparing your response…</p>}
            </div>
          </div>
          <div className="absolute right-3 top-3 h-36 w-36 overflow-hidden rounded-[22px] border-2 border-teal-200/70 bg-black shadow-2xl sm:right-6 sm:top-6 sm:h-52 sm:w-52">
            <video ref={localVideoRef} autoPlay playsInline muted className={"h-full w-full object-cover " + (camOn ? "" : "hidden")} />
            {!camOn && <div className="flex h-full items-center justify-center text-xs text-white/50">Camera off</div>}
          </div>
          {error && <p role="status" className="mx-auto mt-3 max-w-md rounded-xl bg-amber-400/10 px-3 py-2 text-xs text-amber-100">{error}</p>}
        </div>
        <form onSubmit={sendMessage} className="shrink-0 border-t border-white/10 bg-black/50 p-3 pb-[max(16px,env(safe-area-inset-bottom))] backdrop-blur-xl sm:p-4">
          <div className="mx-auto flex w-full max-w-2xl items-end gap-2">
            <button type="button" onClick={startVoiceInput} disabled={busy || listening || !micOn} title="Voice input" className={"h-12 w-12 shrink-0 rounded-full border border-white/10 text-xl " + (listening ? "bg-rose-500/30" : "bg-white/10 hover:bg-white/15")}>{listening ? "🔴" : "🎙️"}</button>
            <textarea value={input} onChange={(e) => { setInput(e.target.value); e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,112)+"px"; }} rows={1} placeholder="Message Aura…" className="max-h-28 min-h-12 min-w-0 flex-1 resize-none overflow-y-auto rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base leading-6 outline-none focus:border-teal-300" />
            <button type="submit" disabled={busy || !input.trim()} className="h-14 w-14 shrink-0 rounded-2xl bg-teal-300 text-2xl font-semibold text-midnight-950 shadow-lg disabled:opacity-40" aria-label="Send message">➤</button>
          </div>
          <div className="mx-auto mt-3 flex w-full max-w-2xl flex-wrap items-center justify-center gap-2 sm:gap-3">
            <button type="button" onClick={toggleMic} className={"h-12 rounded-2xl border border-white/10 px-4 text-sm font-medium sm:px-5 " + (micOn ? "bg-white/10 hover:bg-white/15" : "bg-rose-500/30")}>{micOn ? "🎙️ Mic on" : "🔇 Mic off"}</button>
            <button type="button" onClick={toggleCam} className={"h-12 rounded-2xl border border-white/10 px-4 text-sm font-medium sm:px-5 " + (camOn ? "bg-white/10 hover:bg-white/15" : "bg-rose-500/30")}>{camOn ? "📷 Camera" : "🚫 Camera off"}</button>
            <button type="button" onClick={flipCamera} className="h-12 rounded-2xl border border-white/10 bg-white/10 px-4 text-sm font-medium hover:bg-white/15 sm:px-5">🔄 Flip</button>
            <button type="button" onClick={handleClose} className="h-12 rounded-2xl bg-rose-500 px-6 font-semibold text-white shadow-lg hover:bg-rose-400">End</button>
          </div>
        </form>
      </div>
    </div>
  );
}
