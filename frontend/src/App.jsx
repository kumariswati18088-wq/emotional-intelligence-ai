import React, { useEffect, useState } from "react";
import AvatarScreen from "./components/AvatarScreen";
import ChatBox from "./components/ChatBox";
import ProfileMenu from "./components/ProfileMenu";
import AdminPanel from "./components/AdminPanel";
import LiveCallModal from "./components/LiveCallModal";
import { api } from "./utils/api";
import { speakAuraText } from "./utils/speech";

function readSavedSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("ei_settings") || "{}");
    return {
      avatar: ["GIRL1", "GIRL2", "BOY1", "BOY2"].includes(saved.avatar) ? saved.avatar : "GIRL1",
      voice: ["GIGI", "MATILDA", "ADAM"].includes(saved.voice) ? saved.voice : "GIGI",
      language: typeof saved.language === "string" && saved.language ? saved.language : "en",
    };
  } catch {
    return { avatar: "GIRL1", voice: "GIGI", language: "en" };
  }
}

export default function App() {
  const [token, setToken] = useState(() =>
    localStorage.getItem("ei_token")
  );

  const [user, setUser] = useState(null);

  const [settings, setSettings] = useState(readSavedSettings);

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
            ...readSavedSettings(),
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
          ...readSavedSettings(),
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

  useEffect(() => {
    try {
      localStorage.setItem("ei_settings", JSON.stringify(settings));
    } catch (error) {
      console.warn("Could not save Aura settings locally:", error);
    }
  }, [settings]);

  // Free device-based TTS fallback. Uses the closest available voice on this device.
  function handleAiSpeech(payload) {
    setPendingSpeech(payload);

    if (payload?.audio || !payload?.text) return;
    speakAuraText(payload.text, {
      language: settings.language,
      voice: settings.voice,
    });
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
          <span aria-label="Premium feature" title="Aura Premium" className="text-xl" role="img">👑</span>

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

      <main className="flex-1 grid min-h-0 lg:grid-cols-2 gap-3 sm:gap-6 max-w-6xl w-full mx-auto p-3 sm:p-6">
        <div className="flex flex-col items-center justify-start">
          {!callOpen && <AvatarScreen
            token={token}
            avatar={settings.avatar}
            pendingSpeech={pendingSpeech}
            onSpeechConsumed={() => setPendingSpeech(null)}
          />}

          {!callOpen && pendingSpeech?.audio && (
            <audio
              src={pendingSpeech.audio}
              autoPlay
              controls
              aria-label="Aura voice reply"
              className="w-full max-w-md mt-3"
            />
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-midnight-900/60 overflow-hidden h-[calc(100dvh-118px)] min-h-[320px] lg:h-auto">
          <ChatBox
            token={token}
            language={settings.language}
            voice={settings.voice}
            onAiSpeech={handleAiSpeech}
            onAdminUnlock={setAdminToken}
            onLiveCall={() => setCallOpen(true)}
          />
        </div>
      </main>

      {callOpen && (
        <LiveCallModal
          token={token}
          language={settings.language}
          voice={settings.voice}
          avatar={settings.avatar}
          onVoiceChange={async (nextVoice) => {
            setSettings((current) => ({ ...current, voice: nextVoice }));
            try { await api.updateProfile(token, { voice: nextVoice }); } catch (error) { console.warn("Could not save voice setting:", error); }
          }}
          onClose={() => setCallOpen(false)}
        />
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
