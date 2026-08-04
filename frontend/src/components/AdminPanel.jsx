import React, { useEffect, useState } from "react";
import { api } from "../utils/api";

export default function AdminPanel({ adminToken, onClose }) {
  const [tab, setTab] = useState("users"); // "users" | "settings"
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [{ users }, { settings }] = await Promise.all([
        api.adminUsers(adminToken),
        api.adminGetSettings(adminToken),
      ]);
      setUsers(users);
      setSettings(settings);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateUser(id, updates) {
    try {
      const { user } = await api.adminUpdateUser(adminToken, id, updates);
      setUsers((prev) => prev.map((u) => (u.id === id ? user : u)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteUser(id) {
    if (!confirm("Remove this user account? This cannot be undone.")) return;
    try {
      await api.adminDeleteUser(adminToken, id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleEngine(key) {
    const updated = {
      ...settings,
      emotionEngines: { ...settings.emotionEngines, [key]: !settings.emotionEngines[key] },
    };
    setSettings(updated);
    try {
      const { settings: saved } = await api.adminUpdateSettings(adminToken, {
        emotionEngines: updated.emotionEngines,
      });
      setSettings(saved);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveSiteContent(field, value) {
    const updated = { ...settings, siteContent: { ...settings.siteContent, [field]: value } };
    setSettings(updated);
    try {
      await api.adminUpdateSettings(adminToken, { siteContent: updated.siteContent });
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveDefault(field, value) {
    setSettings((s) => ({ ...s, [field]: value }));
    try {
      await api.adminUpdateSettings(adminToken, { [field]: value });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl bg-midnight-800 border border-coral-400/30 shadow-glow">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-midnight-800">
          <div>
            <h2 className="font-display text-lg">Secret Admin Panel</h2>
            <p className="text-xs text-white/40">Full site control — handle with care</p>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-full hover:bg-white/10">
            ✕
          </button>
        </div>

        <div className="flex gap-2 px-6 pt-4">
          <button
            onClick={() => setTab("users")}
            className={`px-4 py-1.5 text-sm rounded-full ${
              tab === "users" ? "bg-coral-500/20 text-coral-200" : "text-white/50 hover:bg-white/5"
            }`}
          >
            Users
          </button>
          <button
            onClick={() => setTab("settings")}
            className={`px-4 py-1.5 text-sm rounded-full ${
              tab === "settings" ? "bg-coral-500/20 text-coral-200" : "text-white/50 hover:bg-white/5"
            }`}
          >
            Site settings
          </button>
        </div>

        <div className="p-6">
          {error && <p className="text-coral-400 text-sm mb-4">{error}</p>}
          {loading && <p className="text-white/40 text-sm">Loading…</p>}

          {!loading && tab === "users" && (
            <div className="space-y-3">
              {users.length === 0 && <p className="text-white/40 text-sm">No registered users yet.</p>}
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl bg-midnight-900 border border-white/10 px-4 py-3"
                >
                  <div className="flex-1 min-w-[120px]">
                    <p className="text-sm font-medium">{u.username}</p>
                    <p className="text-xs text-white/40">
                      {u.avatar} · {u.voice} · {u.language}
                    </p>
                  </div>
                  <select
                    value={u.avatar}
                    onChange={(e) => updateUser(u.id, { avatar: e.target.value })}
                    className="rounded-lg bg-midnight-800 border border-white/10 px-2 py-1 text-xs"
                  >
                    {["GIRL1", "GIRL2", "BOY1", "BOY2"].map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                  <select
                    value={u.voice}
                    onChange={(e) => updateUser(u.id, { voice: e.target.value })}
                    className="rounded-lg bg-midnight-800 border border-white/10 px-2 py-1 text-xs"
                  >
                    {["GIGI", "MATILDA", "ADAM"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => deleteUser(u.id)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-coral-500/20 text-coral-300 hover:bg-coral-500/30"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {!loading && tab === "settings" && settings && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium mb-2">Emotion engines</h3>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(settings.emotionEngines).map(([key, val]) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-sm rounded-lg bg-midnight-900 border border-white/10 px-3 py-2"
                    >
                      <input type="checkbox" checked={val} onChange={() => toggleEngine(key)} />
                      {key}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-wide text-white/40">
                    Default avatar
                  </label>
                  <select
                    value={settings.defaultAvatar}
                    onChange={(e) => saveDefault("defaultAvatar", e.target.value)}
                    className="mt-1 w-full rounded-lg bg-midnight-900 border border-white/10 px-3 py-2 text-sm"
                  >
                    {["GIRL1", "GIRL2", "BOY1", "BOY2"].map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-white/40">
                    Default voice
                  </label>
                  <select
                    value={settings.defaultVoice}
                    onChange={(e) => saveDefault("defaultVoice", e.target.value)}
                    className="mt-1 w-full rounded-lg bg-midnight-900 border border-white/10 px-3 py-2 text-sm"
                  >
                    {["GIGI", "MATILDA", "ADAM"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-white/40">
                    Default language
                  </label>
                  <input
                    value={settings.defaultLanguage}
                    onChange={(e) => saveDefault("defaultLanguage", e.target.value)}
                    className="mt-1 w-full rounded-lg bg-midnight-900 border border-white/10 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Site content</h3>
                <label className="text-xs uppercase tracking-wide text-white/40">App name</label>
                <input
                  value={settings.siteContent.appName}
                  onChange={(e) => saveSiteContent("appName", e.target.value)}
                  className="mt-1 w-full rounded-lg bg-midnight-900 border border-white/10 px-3 py-2 text-sm mb-3"
                />
                <label className="text-xs uppercase tracking-wide text-white/40">
                  Welcome message
                </label>
                <textarea
                  value={settings.siteContent.welcomeMessage}
                  onChange={(e) => saveSiteContent("welcomeMessage", e.target.value)}
                  className="mt-1 w-full rounded-lg bg-midnight-900 border border-white/10 px-3 py-2 text-sm"
                  rows={2}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
