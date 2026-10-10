import React, { useEffect, useState } from "react";
import AvatarScreen from "./components/AvatarScreen";
import ChatBox from "./components/ChatBox";
import ProfileMenu from "./components/ProfileMenu";
import AdminPanel from "./components/AdminPanel";
import LiveCallModal from "./components/LiveCallModal";
import { api } from "./utils/api";

export default function App() {
  const [token, setToken] = useState(() =>
    localStorage.getItem("ei_token")
  );

  const [user, setUser] = useState(null);

  const [settings, setSettings] = useState({
    avatar: "GIRL1",
    voice: "GIGI",
    language: "en",
  });

  const [pendingSpeech, setPendingSpeech] = useState(null);
  const [adminToken, setAdminToken] = useState(null);
  const [callOpen, setCallOpen] = useState(false);

  // App ko loading screen par permanently lock nahi karna hai.
  const [booting, setBooting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initializeSession() {
      // No token -> automatically create guest session
      if (!token) {
        setBooting(true);

        try {
          const response = await api.guest();

          if (cancelled) return;

          const guestToken = response.token;
          const guestUser = response.user;

          if (!guestToken || !guestUser) {
            throw new Error("Guest session response is invalid");
          }

          localStorage.setItem("ei_token", guestToken);

          setToken(guestToken);
          setUser(guestUser);

          setSettings({
            avatar: guestUser.avatar || "GIRL1",
            voice: guestUser.voice || "GIGI",
            language: guestUser.language || "en",
          });
        } catch (err) {
          console.error("Guest session failed:", err);

          if (!cancelled) {
            setUser(null);
            setBooting(false);
          }

          return;
        }

        if (!cancelled) {
          setBooting(false);
        }

        return;
      }

      // Existing token -> restore user session
      setBooting(true);

      try {
        const response = await api.me(token);

        if (cancelled) return;

        const currentUser = response.user;

        if (!currentUser) {
          throw new Error("User data is missing");
        }

        setUser(currentUser);

        setSettings({
          avatar: currentUser.avatar || "GIRL1",
          voice: currentUser.voice || "GIGI",
          language: currentUser.language || "en",
        });
      } catch (err) {
        console.error("Session restore failed:", err);

        if (cancelled) return;

        // Old/invalid token -> remove it and create a fresh guest session
        localStorage.removeItem("ei_token");
        setToken(null);
        setUser(null);
      } finally {
        if (!cancelled) {
          setBooting(false);
        }
      }
    }

    initializeSession();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Free browser TTS fallback: speak AI replies when the API does not return audio.
  function handleAiSpeech(payload) {
    setPendingSpeech(payload);

    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (payload?.audio || !payload?.text) return;

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(payload.text);
      const languageCodes = {
        hi: "hi-IN", en: "en-US", bn: "bn-IN", ta: "ta-IN",
        te: "te-IN", mr: "mr-IN", gu: "gu-IN", pa: "pa-IN",
        ur: "ur-IN", kn: "kn-IN", ml: "ml-IN", or: "or-IN",
      };
      utterance.lang = languageCodes[settings.language] || settings.language || "en-US";
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.warn("Browser speech playback unavailable:", error);
    }
  }

  function handleLogout() {
    localStorage.removeItem("ei_token");
    setToken(null);
    setUser(null);
    setAdminToken(null);
  }

  function retryGuestSession() {
    localStorage.removeItem("ei_token");
    setToken(null);
    setUser(null);
    setBooting(false);
  }

  // Initial/session loading
  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-lavender-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Guest session failed
  // Login page intentionally disabled.
  if (!user || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl border border-white/10 bg-midnight-900/60 p-6 text-center">
          <h2 className="text-xl font-semibold mb-3">
            Unable to start Aura
          </h2>

          <p className="text-white/60 text-sm mb-6">
            The guest session could not be created. Please try again.
          </p>

          <button
            onClick={retryGuestSession}
            className="px-5 py-2.5 rounded-full bg-teal-400/20 border border-teal-300/30 text-teal-200 hover:bg-teal-400/30"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xl">✦</span>
          <h1 className="font-display text-xl">Aura</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setCallOpen(true)}
            className="px-4 py-2 rounded-full bg-teal-400/15 border border-teal-300/30 text-teal-200 text-sm hover:bg-teal-400/25"
          >
            📞 Live call
          </button>

          <ProfileMenu
            token={token}
            user={user}
            settings={settings}
            onSettingsChange={setSettings}
            onUserUpdate={setUser}
            onLogout={handleLogout}
          />
        </div>
      </header>

      <main className="flex-1 grid lg:grid-cols-2 gap-6 max-w-6xl w-full mx-auto p-6">
        <div className="flex flex-col items-center justify-start">
          <AvatarScreen
            token={token}
            avatar={settings.avatar}
            pendingSpeech={pendingSpeech}
            onSpeechConsumed={() => setPendingSpeech(null)}
          />

          {pendingSpeech?.audio && (
            <audio
              src={pendingSpeech.audio}
              autoPlay
              controls
              aria-label="Aura voice reply"
              className="w-full max-w-md mt-3"
            />
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-midnight-900/60 overflow-hidden h-[70vh] lg:h-auto">
          <ChatBox
            token={token}
            language={settings.language}
            voice={settings.voice}
            onAiSpeech={handleAiSpeech}
            onAdminUnlock={setAdminToken}
          />
        </div>
      </main>

      {callOpen && (
        <LiveCallModal onClose={() => setCallOpen(false)} />
      )}

      {adminToken && (
        <AdminPanel
          adminToken={adminToken}
          onClose={() => setAdminToken(null)}
        />
      )}
    </div>
  );
}
