import React, { useEffect, useRef, useState } from "react";

export default function LiveCallModal({ onClose }) {
  const localVideoRef = useRef(null);
  const streamRef = useRef(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [facingMode, setFacingMode] = useState("user");
  const [error, setError] = useState("");

  useEffect(() => {
    startStream(facingMode);
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startStream(mode) {
    try {
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode },
        audio: true,
      });
      streamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setMicOn(stream.getAudioTracks().every((t) => t.enabled));
      setCamOn(stream.getVideoTracks().every((t) => t.enabled));
    } catch (err) {
      setError("Camera/microphone access was denied or unavailable.");
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  function toggleMic() {
    const tracks = streamRef.current?.getAudioTracks() || [];
    const next = !micOn;
    tracks.forEach((t) => (t.enabled = next));
    setMicOn(next);
  }

  function toggleCam() {
    const tracks = streamRef.current?.getVideoTracks() || [];
    const next = !camOn;
    tracks.forEach((t) => (t.enabled = next));
    setCamOn(next);
  }

  async function flipCamera() {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    await startStream(next);
  }

  function handleClose() {
    stopStream();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="relative w-full max-w-3xl aspect-video rounded-3xl overflow-hidden bg-midnight-900 border border-white/10">
        {/* Placeholder for the AI avatar's live video during the call —
            wire this up to the same HeyGen stream used in AvatarScreen. */}
        <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm">
          AI companion video feed
        </div>

        {/* Picture-in-picture: the user's own camera */}
        <div className="absolute bottom-4 right-4 w-32 sm:w-44 aspect-video rounded-xl overflow-hidden border border-white/20 bg-black shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${camOn ? "" : "hidden"}`}
          />
          {!camOn && (
            <div className="w-full h-full flex items-center justify-center text-white/40 text-xs">
              Camera off
            </div>
          )}
        </div>

        {error && (
          <div className="absolute top-4 left-4 right-4 rounded-lg bg-coral-500/20 border border-coral-400/30 text-coral-200 text-sm px-3 py-2">
            {error}
          </div>
        )}

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/50 backdrop-blur rounded-full px-4 py-2">
          <button
            onClick={toggleMic}
            className={`h-10 w-10 rounded-full flex items-center justify-center ${
              micOn ? "bg-white/10" : "bg-coral-500/60"
            }`}
            title={micOn ? "Mute microphone" : "Unmute microphone"}
          >
            {micOn ? "🎙️" : "🔇"}
          </button>
          <button
            onClick={toggleCam}
            className={`h-10 w-10 rounded-full flex items-center justify-center ${
              camOn ? "bg-white/10" : "bg-coral-500/60"
            }`}
            title={camOn ? "Turn camera off" : "Turn camera on"}
          >
            {camOn ? "📷" : "🚫"}
          </button>
          <button
            onClick={flipCamera}
            className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center"
            title="Switch front/back camera"
          >
            🔄
          </button>
          <button
            onClick={handleClose}
            className="h-10 px-4 rounded-full bg-coral-500 text-midnight-950 font-medium text-sm"
          >
            End call
          </button>
        </div>
      </div>
    </div>
  );
}
