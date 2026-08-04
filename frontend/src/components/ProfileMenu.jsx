import React, { useState } from "react";
import { api } from "../utils/api";

const AVATARS = [
  { key: "GIRL1", label: "Girl 1" },
  { key: "GIRL2", label: "Girl 2" },
  { key: "BOY1", label: "Boy 1" },
  { key: "BOY2", label: "Boy 2" },
];

const VOICES = [
  { key: "GIGI", label: "Cute Gigi" },
  { key: "MATILDA", label: "Matilda" },
  { key: "ADAM", label: "Adam" },
];

const LANGUAGES = [
  { key: "en", label: "English" },
  { key: "hi", label: "Hindi" },
  { key: "es", label: "Spanish" },
  { key: "fr", label: "French" },
  { key: "de", label: "German" },
  { key: "ja", label: "Japanese" },
  { key: "zh", label: "Chinese" },
  { key: "ar", label: "Arabic" },
  { key: "pt", label: "Portuguese" },
];

export default function ProfileMenu({ token, user, settings, onSettingsChange, onUserUpdate, onLogout }) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [form, setForm] = useState({ username: user.username, password: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSetting(key, value) {
    onSettingsChange({ ...settings, [key]: value });
    try {
      await api.updateProfile(token, { [key]: value });
    } catch {
      // Non-fatal: local UI already reflects the change; retry silently on next save.
    }
  }

  async function handleProfileSave(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const updates = { username: form.username };
      if (form.password) updates.password = form.password;
      const { user: updatedUser } = await api.updateProfile(token, updates);
      onUserUpdate(updatedUser);
      setProfileOpen(false);
      setForm({ username: updatedUser.username, password: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-10 w-10 rounded-full bg-lavender-500/20 border border-lavender-400/30 flex items-center justify-center font-medium text-sm"
      >
        {user.username?.[0]?.toUpperCase() || "U"}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-midnight-800 border border-white/10 shadow-glow p-4 space-y-4 z-30">
          <div>
            <p className="text-sm font-medium">{user.username}</p>
            <p className="text-xs text-white/40">Signed in</p>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-white/40">Avatar</label>
            <select
              value={settings.avatar}
              onChange={(e) => handleSetting("avatar", e.target.value)}
              className="mt-1 w-full rounded-lg bg-midnight-900 border border-white/10 px-3 py-2 text-sm"
            >
              {AVATARS.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-white/40">Voice</label>
            <select
              value={settings.voice}
              onChange={(e) => handleSetting("voice", e.target.value)}
              className="mt-1 w-full rounded-lg bg-midnight-900 border border-white/10 px-3 py-2 text-sm"
            >
              {VOICES.map((v) => (
                <option key={v.key} value={v.key}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-white/40">Language</label>
            <select
              value={settings.language}
              onChange={(e) => handleSetting("language", e.target.value)}
              className="mt-1 w-full rounded-lg bg-midnight-900 border border-white/10 px-3 py-2 text-sm"
            >
              {LANGUAGES.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
            <button
              onClick={() => {
                setProfileOpen(true);
                setOpen(false);
              }}
              className="text-sm text-left px-3 py-2 rounded-lg hover:bg-white/5"
            >
              Edit profile
            </button>
            <button
              onClick={onLogout}
              className="text-sm text-left px-3 py-2 rounded-lg text-coral-400 hover:bg-coral-500/10"
            >
              Log out
            </button>
          </div>
        </div>
      )}

      {profileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-2xl bg-midnight-800 border border-white/10 p-6 space-y-4">
            <h3 className="font-display text-lg">Edit profile</h3>
            <form onSubmit={handleProfileSave} className="space-y-3">
              <div>
                <label className="text-xs uppercase tracking-wide text-white/40">Username</label>
                <input
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  className="mt-1 w-full rounded-lg bg-midnight-900 border border-white/10 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-white/40">
                  New password (optional)
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="mt-1 w-full rounded-lg bg-midnight-900 border border-white/10 px-3 py-2 text-sm"
                  placeholder="Leave blank to keep current password"
                />
              </div>
              {error && <p className="text-coral-400 text-sm">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProfileOpen(false)}
                  className="px-4 py-2 text-sm rounded-lg hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm rounded-lg bg-lavender-500 hover:bg-lavender-400 text-midnight-950 font-medium disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
