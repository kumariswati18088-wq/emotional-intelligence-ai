import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { LiveAvatarSession } from "@heygen/liveavatar-web-sdk";
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

export default function AvatarScreen({
  token,
  avatar,
  pendingSpeech,
  onSpeechConsumed,
}) {
  const videoRef = useRef(null);
  const sessionRef = useRef(null);
  const sessionTokenRef = useRef(null);

  const [status, setStatus] = useState("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState("Neutral");
  const [errorMsg, setErrorMsg] = useState("");

  // --- Step 1: Stop the current LiveAvatar session ---
  const stopSession = useCallback(async () => {
    const session = sessionRef.current;

    sessionRef.current = null;
    sessionTokenRef.current = null;

    if (session) {
      try {
        await session.stop();
      } catch (err) {
        console.warn("LiveAvatar stop error:", err);
      }
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsSpeaking(false);
  }, []);

  // --- Step 2: Create and start a LiveAvatar session ---
  useEffect(() => {
    let cancelled = false;

    async function connect() {
      setStatus("connecting");
      setErrorMsg("");

      try {
        // Ask our backend for a LiveAvatar session token.
        const response = await api.heygenSession(token, avatar);

        if (cancelled) return;

        const sessionToken = response?.sessionToken;

        if (!sessionToken) {
          throw new Error(
            "LiveAvatar session token was not returned by the backend"
          );
        }

        sessionTokenRef.current = sessionToken;

        // Create the official LiveAvatar Web SDK session.
        const session = new LiveAvatarSession(sessionToken, {
          autoKeepAlive: true,

          // Aura's own ChatBox already handles the user's messages,
          // so LiveAvatar microphone/voice chat stays muted.
          voiceChat: {
            defaultMuted: true,
          },
        });

        sessionRef.current = session;

        if (cancelled) {
          await session.stop().catch(() => {});
          return;
        }

        // Start the LiveAvatar session.
        await session.start();

        if (cancelled) {
          await session.stop().catch(() => {});
          return;
        }

        // Attach the LiveAvatar video/audio stream to our video element.
        if (videoRef.current) {
          session.attach(videoRef.current);
        }

        setStatus("live");
      } catch (err) {
        console.error("LiveAvatar connection error:", err);

        if (!cancelled) {
          setStatus("error");
          setErrorMsg(
            err?.message ||
              "Could not connect to the avatar stream"
          );
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      stopSession();
    };
  }, [avatar, token, stopSession]);

  // --- Step 3: Make the avatar speak the AI response ---
  useEffect(() => {
    if (
      !pendingSpeech?.text ||
      status !== "live" ||
      !sessionRef.current
    ) {
      return;
    }

    const session = sessionRef.current;

    setCurrentEmotion(
      pendingSpeech.emotion || "Neutral"
    );

    setIsSpeaking(true);

    try {
      // FULL-mode LiveAvatar supports text speech through repeat().
      session.repeat(pendingSpeech.text);
    } catch (err) {
      console.error("LiveAvatar speak error:", err);
    } finally {
      onSpeechConsumed?.();

      // The SDK controls the actual speaking duration.
      // Keep the visual speaking state short and reset it.
      window.setTimeout(() => {
        setIsSpeaking(false);
      }, 1500);
    }
  }, [
    pendingSpeech,
    status,
    onSpeechConsumed,
  ]);

  return (
    <div className="relative w-full aspect-square max-w-md mx-auto rounded-3xl overflow-hidden border border-white/10 bg-midnight-900 shadow-glow">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className={`w-full h-full object-cover transition-opacity duration-700 ${
          status === "live"
            ? "opacity-100"
            : "opacity-0"
        }`}
      />

      {status !== "live" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-midnight-900/90">
          {status === "connecting" && (
            <>
              <div className="h-10 w-10 rounded-full border-2 border-lavender-400 border-t-transparent animate-spin" />

              <p className="text-white/60 text-sm">
                Connecting to your companion…
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <p className="text-red-400 text-sm px-6 text-center">
                {errorMsg}
              </p>
            </>
          )}

          {status === "idle" && (
            <p className="text-white/40 text-sm">
              Avatar stream idle
            </p>
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
            status === "live"
              ? "bg-teal-400"
              : "bg-white/30"
          }`}
        />

        {EMOTION_LABELS[currentEmotion] ||
          currentEmotion}
      </div>
    </div>
  );
}
