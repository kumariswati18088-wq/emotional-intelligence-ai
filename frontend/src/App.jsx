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
    <div className="aura-app min-h-screen flex flex-col">
      <header className="aura-header">
        <button type="button" className="aura-icon-button" aria-label="Focus chat" onClick={() => document.getElementById("aura-chat-input")?.focus()}>☰</button>
        <div className="aura-brand"><span className="aura-brand-mark">✧</span><span>Aura</span></div>
        <div className="aura-header-actions">
          <button type="button" className="aura-premium" title="Aura Premium" aria-label="Aura Premium">👑</button>
          <ProfileMenu token={token} user={user} settings={settings} onSettingsChange={setSettings} onUserUpdate={setUser} onLogout={handleLogout} />
        </div>
      </header>
      <nav className="aura-mode-switch" aria-label="Conversation mode">
        <button type="button" className={!callOpen ? "active" : ""} onClick={() => setCallOpen(false)}>☏ <span>Normal Chat</span></button>
        <button type="button" className={callOpen ? "active" : ""} onClick={() => setCallOpen(true)}>▣ <span>Live Call</span></button>
      </nav>
      <main className="aura-main">
        <section className="aura-chat-column">
          <div className="aura-welcome-card">
            <div className="aura-welcome-avatar" aria-hidden="true"><span>✧</span><i>✦</i></div>
            <h2>Hello, I’m Aura</h2><p>Your AI companion, always here for you.</p><span className="aura-welcome-spark">✦</span>
          </div>
          <div className="aura-chat-panel">
            <div className="aura-chat-heading"><span className="aura-chat-bubble">☏</span><span>Chat with Aura</span><span className="aura-online-dot" title="Ready" /></div>
            <ChatBox token={token} language={settings.language} voice={settings.voice} onAiSpeech={handleAiSpeech} onAdminUnlock={setAdminToken} onLiveCall={() => setCallOpen(true)} />
          </div>
        </section>
        <aside className="aura-side-column">
          <div className="aura-side-avatar">
            <div className="aura-live-badge"><span /> YOUR COMPANION</div>
            {!callOpen && <AvatarScreen token={token} avatar={settings.avatar} pendingSpeech={pendingSpeech} onSpeechConsumed={() => setPendingSpeech(null)} />}
            {callOpen && <div className="aura-avatar-placeholder"><span>✧</span><p>Your live call is open</p></div>}
            <div className="aura-avatar-caption"><span className="aura-caption-orb">✦</span><div><strong>Aura</strong><small>{callOpen ? "Here with you, live" : "Ready to listen"}</small></div></div>
          </div>
          <div className="aura-voice-card">
            <div><span className="aura-sound-icon">♫</span><div><strong>Voice & language</strong><small>Personalize your companion</small></div></div>
            <label>Voice<select value={settings.voice} onChange={(e) => setSettings((v) => ({ ...v, voice: e.target.value }))}><option value="GIGI">Gigi · Feminine</option><option value="MATILDA">Matilda · Feminine</option></select></label>
            <label>Language<select value={settings.language} onChange={(e) => setSettings((v) => ({ ...v, language: e.target.value }))}><option value="en">English</option><option value="hi">Hindi</option><option value="bn">Bengali</option><option value="ta">Tamil</option><option value="te">Telugu</option><option value="mr">Marathi</option><option value="gu">Gujarati</option><option value="pa">Punjabi</option><option value="ur">Urdu</option></select></label>
            <p>♡ A gentle voice, whenever you need it.</p>
          </div>
        </aside>
      </main>
      {callOpen && <LiveCallModal token={token} language={settings.language} voice={settings.voice} avatar={settings.avatar} onVoiceChange={async (nextVoice) => { setSettings((current) => ({ ...current, voice: nextVoice })); try { await api.updateProfile(token, { voice: nextVoice }); } catch (error) { console.warn("Could not save voice setting:", error); } }} onClose={() => setCallOpen(false)} />}
      {adminToken && <AdminPanel adminToken={adminToken} onClose={() => setAdminToken(null)} />}
    </div>
  );
}
