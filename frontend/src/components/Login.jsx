import React, { useEffect, useState } from "react";
import { api } from "../utils/api";

export default function Login({ onAuthenticated }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;
    let cancelled = false;
    const renderGoogleButton = () => {
      if (cancelled || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: async (response) => {
        setError(""); setGoogleLoading(true);
        try { const result = await api.googleLogin(response.credential); onAuthenticated(result.token, result.user); }
        catch (err) { setError(err.message || "Google login failed."); }
        finally { setGoogleLoading(false); }
      }});
      const container = document.getElementById("aura-google-login");
      if (container) { container.innerHTML = ""; window.google.accounts.id.renderButton(container, { theme: "filled_black", size: "large", shape: "rect", text: "continue_with", width: Math.min(340, container.clientWidth || 340) }); }
    };
    if (window.google?.accounts?.id) { renderGoogleButton(); return () => { cancelled = true; }; }
    const script = document.createElement("script"); script.src = "https://accounts.google.com/gsi/client"; script.async = true; script.defer = true; script.onload = renderGoogleButton;
    script.onerror = () => { if (!cancelled) setError("Google sign-in could not load. Check your connection."); };
    document.head.appendChild(script);
    return () => { cancelled = true; };
  }, [onAuthenticated]);
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api.login(username.trim(), password);
      onAuthenticated(result.token, result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-lavender-500/15 border border-lavender-400/30 mb-4">
            <span className="text-2xl">✦</span>
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Aura
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Your emotionally intelligent companion
          </p>
        </div>

        <div className="bg-midnight-800/70 border border-white/10 rounded-2xl p-6 shadow-glow backdrop-blur">
          <div className="mb-5">
            <div id="aura-google-login" className="flex justify-center min-h-10" />
            {!import.meta.env.VITE_GOOGLE_CLIENT_ID && <p className="text-white/40 text-xs text-center mt-2">Google login needs VITE_GOOGLE_CLIENT_ID in Vercel.</p>}
            {googleLoading && <p className="text-white/60 text-sm text-center mt-2">Signing in with Google…</p>}
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-white/40">
                Username
              </label>
              <input
                className="mt-1 w-full rounded-lg bg-midnight-900/70 border border-white/10 px-3 py-2.5 text-sm focus:border-lavender-400 outline-none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-white/40">
                Password
              </label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg bg-midnight-900/70 border border-white/10 px-3 py-2.5 text-sm focus:border-lavender-400 outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-coral-400 text-sm" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-lavender-500 hover:bg-lavender-400 transition text-midnight-950 font-medium text-sm disabled:opacity-50"
            >
              {loading ? "Logging in…" : "Log in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
