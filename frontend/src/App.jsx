import React, { useEffect, useState } from "react";
import Login from "./components/Login";
import AvatarScreen from "./components/AvatarScreen";
import ChatBox from "./components/ChatBox";
import ProfileMenu from "./components/ProfileMenu";
import AdminPanel from "./components/AdminPanel";
import LiveCallModal from "./components/LiveCallModal";
import { api } from "./utils/api";

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("ei_token"));
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({
    avatar: "GIRL1",
    voice: "GIGI",
    language: "en",
  });
  const [pendingSpeech, setPendingSpeech] = useState(null);
  const [adminToken, setAdminToken] = useState(null);
  const [callOpen, setCallOpen] = useState(false);
  const [booting, setBooting] = useState(true);

  // Rehydrate session on load.
  useEffect(() => {
    if (!token) {
      setBooting(false);
      return;
    }
    api
      .me(token)
      .then(({ user }) => {
        setUser(user);
        setSettings({ avatar: user.avatar, voice: user.voice, language: user.language });
      })
      .catch(() => {
        localStorage.removeItem("ei_token");
        setToken(null);
      })
      .finally(() => setBooting(false));
  }, [token]);

  function handleAuthenticated(newToken, newUser) {
    localStorage.setItem("ei_token", newToken);
    setToken(newToken);
    setUser(newUser);
    setSettings({ avatar: newUser.avatar, voice: newUser.voice, language: newUser.language });
  }

  function handleLogout() {
    localStorage.removeItem("ei_token");
    setToken(null);
    setUser(null);
    setAdminToken(null);
  }

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-lavender-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!token || !user) {
    return <Login onAuthenticated={handleAuthenticated} />;
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
              // Set to muted by default to avoid double-voice with HeyGen's
              // own synthesis of the same text — unmute if your HeyGen plan
              // is configured to accept externally-generated audio instead.
              muted
              hidden
            />
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-midnight-900/60 overflow-hidden h-[70vh] lg:h-auto">
          <ChatBox
            token={token}
            language={settings.language}
            voice={settings.voice}
            onAiSpeech={setPendingSpeech}
            onAdminUnlock={setAdminToken}
          />
        </div>
      </main>

      {callOpen && <LiveCallModal onClose={() => setCallOpen(false)} />}
      {adminToken && <AdminPanel adminToken={adminToken} onClose={() => setAdminToken(null)} />}
    </div>
  );
}
