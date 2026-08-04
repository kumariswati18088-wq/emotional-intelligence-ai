import React, { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../utils/api";

const EMOTION_LABELS = {
  Joy: "😊 Joy",
  Laughing: "😄 Laughing",
  Sadness: "😔 Sadness",
  Crying: "😢 Crying",
  Anger: "😠 Anger",
  Fear: "😟 Fear",
  Surprise: "😲 Surprise",
  Neutral: "🙂 Neutral",
};

export default function AvatarScreen({ token, avatar, pendingSpeech, onSpeechConsumed }) {
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const heygenSessionIdRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | connecting | live | error
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState("Neutral");
  const [errorMsg, setErrorMsg] = useState("");

  const stopSession = useCallback(async () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (heygenSessionIdRef.current) {
      api.heygenStop(token, heygenSessionIdRef.current).catch(() => {});
      heygenSessionIdRef.current = null;
    }
  }, [token]);

  // Establish WebRTC session with HeyGen via backend proxy
  useEffect(() => {
    let cancelled = false;

    async function connect() {
      setStatus("connecting");
      setErrorMsg("");

      try {
        // 1. Create HeyGen streaming session — server returns SDP offer + ICE servers
        const { sessionId, sdpOffer, iceServers } = await api.heygenSession(token, avatar);
        if (cancelled) return;

        heygenSessionIdRef.current = sessionId;

        // 2. Create RTCPeerConnection with HeyGen's ICE servers
        const pc = new RTCPeerConnection({ iceServers, iceTransportPolicy: "all" });
        pcRef.current = pc;

        // 3. When remote media track arrives, bind to video element
        pc.ontrack = (event) => {
          if (cancelled) return;
          if (videoRef.current && event.streams.length > 0) {
            videoRef.current.srcObject = event.streams[0];
            setStatus("live");
          }
        };

        // 4. Forward local ICE candidates to HeyGen through the backend
        pc.onicecandidate = ({ candidate }) => {
          if (candidate && heygenSessionIdRef.current) {
            api.heygenIce(token, heygenSessionIdRef.current, {
              candidate: candidate.candidate,
              sdpMid: candidate.sdpMid ?? "0",
              sdpMLineIndex: candidate.sdpMLineIndex ?? 0,
            }).catch(() => {});
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (cancelled) return;
          const s = pc.iceConnectionState;
          if (s === "failed" || s === "disconnected") {
            setStatus("error");
            setErrorMsg("Connection lost. Reload to reconnect.");
          }
        };

        // 5. Set HeyGen's SDP offer as remote description
        await pc.setRemoteDescription(new RTCSessionDescription(sdpOffer));

        // 6. Create local SDP answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // 7. Send SDP answer to HeyGen via backend
        await api.heygenStart(token, sessionId, { type: answer.type, sdp: answer.sdp });

        if (cancelled) {
          stopSession();
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(err.message || "Could not connect to the avatar stream");
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      stopSession();
    };
  }, [avatar, token]); // reconnect when avatar selection changes

  // Speak whatever text the chat pipeline hands down
  useEffect(() => {
    if (!pendingSpeech || status !== "live" || !heygenSessionIdRef.current) return;

    setCurrentEmotion(pendingSpeech.emotion || "Neutral");
    setIsSpeaking(true);

    api
      .heygenSpeak(token, heygenSessionIdRef.current, pendingSpeech.text)
      .catch((err) => console.error("Avatar speak error:", err))
      .finally(() => {
        setIsSpeaking(false);
        onSpeechConsumed?.();
      });
  }, [pendingSpeech, status, token]);

  return (
    <div className="relative w-full aspect-square max-w-md mx-auto rounded-3xl overflow-hidden border border-white/10 bg-midnight-900 shadow-glow">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-cover transition-opacity duration-700 ${
          status === "live" ? "opacity-100" : "opacity-0"
        }`}
      />

      {status !== "live" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-midnight-900/90">
          {status === "connecting" && (
            <>
              <div className="h-10 w-10 rounded-full border-2 border-lavender-400 border-t-transparent animate-spin" />
              <p className="text-white/60 text-sm">Connecting to your companion…</p>
            </>
          )}
          {status === "error" && (
            <p className="text-red-400 text-sm px-6 text-center">{errorMsg}</p>
          )}
          {status === "idle" && (
            <p className="text-white/40 text-sm">Avatar stream idle</p>
          )}
        </div>
      )}

      <div
        className={`absolute inset-0 pointer-events-none rounded-3xl ${
          isSpeaking ? "speaking-ring" : ""
        }`}
      />

      <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-black/40 backdrop-blur px-3 py-1 text-xs">
        <span
          className={`h-2 w-2 rounded-full ${
            status === "live" ? "bg-teal-400" : "bg-white/30"
          }`}
        />
        {EMOTION_LABELS[currentEmotion] || currentEmotion}
      </div>
    </div>
  );
}
