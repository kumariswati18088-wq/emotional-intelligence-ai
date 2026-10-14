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
      avatar: ["GIRL1", "GIRL2"].includes(saved.avatar) ? saved.avatar : "GIRL1",
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
  const [auraThinking, setAuraThinking] = useState(false);

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
    <div className={`aura-app aura-shell ${callOpen ? "is-call-open" : ""}`}>
      <header className="aura-header">
        <div className="aura-brand"><span className="aura-brand-mark">✧</span><span>Aura</span></div>
        <div className="aura-header-actions">
          <button type="button" className="aura-premium" title="Aura Premium" aria-label="Aura Premium" onClick={() => window.dispatchEvent(new CustomEvent("aura:premium"))}><span aria-hidden="true">♛</span></button>
          <ProfileMenu token={token} user={user} settings={settings} onSettingsChange={setSettings} onUserUpdate={setUser} onLogout={handleLogout} />
        </div>
      </header>
      <main className="aura-main aura-main-single">
        <section className="aura-video-stage" aria-label="Aura video">
          <AvatarScreen token={token} avatar={settings.avatar} pendingSpeech={pendingSpeech} thinking={auraThinking} onSpeechConsumed={() => setPendingSpeech(null)} />
        </section>
        <section className="aura-chat-panel aura-chat-panel-main">
          <div className="aura-chat-heading"><span className="aura-chat-bubble" aria-hidden="true">◌</span><span>Chat with Aura</span><span className="aura-online-dot" title="Ready" /></div>
          <ChatBox token={token} language={settings.language} voice={settings.voice} onAiSpeech={handleAiSpeech} onAdminUnlock={setAdminToken} onLiveCall={() => setCallOpen(true)} onThinkingChange={setAuraThinking} />
        </section>
      </main>
      {callOpen && <LiveCallModal token={token} language={settings.language} voice={settings.voice} avatar={settings.avatar} onVoiceChange={async (nextVoice) => { setSettings((current) => ({ ...current, voice: nextVoice })); try { await api.updateProfile(token, { voice: nextVoice }); } catch (error) { console.warn("Could not save voice setting:", error); } }} onClose={() => setCallOpen(false)} />}
      {adminToken && <AdminPanel adminToken={adminToken} onClose={() => setAdminToken(null)} />}
    </div>
  );
}
