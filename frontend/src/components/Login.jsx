import React, { useState } from "react";
import { api } from "../utils/api";

export default function Login({ onAuthenticated }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result =
        mode === "login"
          ? await api.login(username, password)
          : await api.register(username, password);
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
          <div className="flex mb-6 rounded-xl bg-midnight-900/60 p-1">
            <button
              className={`flex-1 py-2 text-sm rounded-lg transition ${
                mode === "login" ? "bg-lavender-500/20 text-white" : "text-white/50"
              }`}
              onClick={() => setMode("login")}
              type="button"
            >
              Log in
            </button>
            <button
              className={`flex-1 py-2 text-sm rounded-lg transition ${
                mode === "register" ? "bg-lavender-500/20 text-white" : "text-white/50"
              }`}
              onClick={() => setMode("register")}
              type="button"
            >
              Create account
            </button>
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
                autoComplete={mode === "login" ? "current-password" : "new-password"}
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
              {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
