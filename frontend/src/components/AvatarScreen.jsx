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
  const animationVideoRef = useRef(null);
  const animationTimerRef = useRef(null);
  const sessionRef = useRef(null);
  const sessionTokenRef = useRef(null);

  const [status, setStatus] = useState("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState("Neutral");
  const [animationName, setAnimationName] = useState("idle");
  const [showEmotionAnimation, setShowEmotionAnimation] = useState(false);
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

  // Local MP4 emotion clips are served from Vite's public directory.
  // Keep LiveAvatar as the main stream; briefly overlay the matching clip
  // when Aura replies, and use the idle clip whenever the stream is unavailable.
  useEffect(() => {
    const video = animationVideoRef.current;
    if (!video) return;
    video.muted = true;
    video.loop = true;
    const playPromise = video.play();
    if (playPromise?.catch) playPromise.catch(() => {});
  }, [animationName, status]);

  useEffect(() => () => {
    if (animationTimerRef.current) window.clearTimeout(animationTimerRef.current);
  }, []);

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

    const rawEmotion = String(pendingSpeech.emotion || "Neutral").toLowerCase();
    const clipName = rawEmotion.includes("cry") ? "crying"
      : rawEmotion.includes("sad") ? "sad"
      : rawEmotion.includes("ang") ? "angry"
      : rawEmotion.includes("surpris") ? "surprised"
      : rawEmotion.includes("joy") || rawEmotion.includes("laugh") || rawEmotion.includes("happy") ? "happy"
      : rawEmotion.includes("fear") || rawEmotion.includes("think") ? "thinking"
      : "idle";
    setCurrentEmotion(pendingSpeech.emotion || "Neutral");
    setAnimationName(clipName);
    setShowEmotionAnimation(true);
    if (animationTimerRef.current) window.clearTimeout(animationTimerRef.current);
    animationTimerRef.current = window.setTimeout(() => {
      setShowEmotionAnimation(false);
      setAnimationName("idle");
    }, 4500);

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
        ref={animationVideoRef}
        src={`/videos/aura-${animationName}.mp4`}
        autoPlay
        loop
        muted
        playsInline
        aria-label={`Aura ${animationName} emotion animation`}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
          status !== "live" || showEmotionAnimation ? "opacity-100" : "opacity-0"
        }`}
      />

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className={`w-full h-full object-cover transition-opacity duration-700 ${
          status === "live" && !showEmotionAnimation
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
