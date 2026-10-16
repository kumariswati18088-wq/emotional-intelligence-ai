import React, { useEffect, useState } from "react";
import AvatarScreen from "./components/AvatarScreen";
import ChatBox from "./components/ChatBox";
import ProfileMenu from "./components/ProfileMenu";
import Login from "./components/Login";
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
      // No token -> show the login/register page.
      if (!token) {
        setUser(null);
        setBooting(false);
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

        // A saved guest token should not bypass the login page.
        if (currentUser.isGuest) {
          localStorage.removeItem("ei_token");
          setToken(null);
          setUser(null);
          return;
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

    if (!payload?.text) return;
    // Always synthesize cleaned text locally; server audio may pronounce emoji names/sounds.
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

  function handleAuthenticated(authToken, authenticatedUser) {
    localStorage.setItem("ei_token", authToken);
    setToken(authToken);
    setUser(authenticatedUser);
    setSettings({
      avatar: authenticatedUser.avatar || "GIRL1",
      voice: authenticatedUser.voice || "GIGI",
      language: authenticatedUser.language || "en",
      ...readSavedSettings(),
    });
  }

  // Initial/session loading
  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-lavender-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user || !token) {
    return <Login onAuthenticated={handleAuthenticated} />;
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
