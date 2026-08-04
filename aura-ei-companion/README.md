# Aura — Emotional Intelligence AI Companion

Full-stack app: React + Vite + Tailwind frontend, Express backend, orchestrating
Hume AI (emotion) → Gemini (reply text) → ElevenLabs (speech) → HeyGen (avatar video).

## Structure

```
backend/
  server.js            Express entry point
  routes/auth.js        register / login / profile
  routes/chat.js         Hume -> Gemini -> ElevenLabs pipeline
  routes/heygen.js       streaming-avatar session + token endpoints
  routes/admin.js        secret-phrase verification + admin CRUD
  middleware/auth.js     JWT guards (user + admin)
  utils/providers.js     all third-party API calls live here
  utils/store.js         JSON-file data store (swap for a real DB later)
  .env.example

frontend/
  src/App.jsx
  src/components/Login.jsx
  src/components/AvatarScreen.jsx   HeyGen streaming-avatar SDK integration
  src/components/ChatBox.jsx        chat + IndexedDB media attachments
  src/components/ProfileMenu.jsx    avatar/voice/language + profile modal + logout
  src/components/LiveCallModal.jsx  WebRTC camera/mic call UI
  src/components/AdminPanel.jsx     secret admin control panel
  src/utils/api.js
  src/utils/db.js                    IndexedDB wrapper (media never leaves the browser)
```

## Setup

```bash
# Backend
cd backend
cp .env.example .env   # fill in your real API keys and IDs
npm install
npm run dev             # http://localhost:5000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev              # http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:5000`, so the two
run side by side without CORS headaches in development.

## How the secret admin panel works

1. The real password (`Rounak@2523` by default) lives **only** in the backend's
   `.env` as `ADMIN_SECRET_PASSWORD` — it is never bundled into the frontend JS.
2. When a user's chat message is short and doesn't match the normal flow,
   the client calls `POST /api/admin/verify` with the raw text.
3. If it matches, the server issues a short-lived (30 min) admin JWT and the
   client opens `AdminPanel`. Everything else — user CRUD, emotion-engine
   toggles, avatar/voice/language defaults, site copy — is guarded by
   `requireAdmin` middleware on the server.
4. **Change the password before deploying.** A shared string typed into a
   public chat box is inherently guessable; for real production use, pair
   this with IP allow-listing or a proper admin login instead of a bare
   secret phrase.

## Known integration seams to finish before production

- **Hume AI**: the code calls Hume's batch-job endpoint and falls back to a
  keyword heuristic if that doesn't return synchronously. For true real-time
  emotion detection, swap in Hume's **streaming WebSocket API** — the shape
  of `detectEmotion()` in `utils/providers.js` is the only thing that needs
  to change.
- **ElevenLabs audio → HeyGen lip-sync**: the pipeline generates ElevenLabs
  audio server-side, but the HeyGen public streaming SDK's `speak()` call
  drives lip-sync from **text**, using HeyGen's own voice engine — it doesn't
  accept an arbitrary external audio buffer in the base tier. Right now the
  frontend plays the ElevenLabs clip muted so it doesn't double up with
  HeyGen's voice, and HeyGen animates from the same reply text. If your
  HeyGen plan supports custom audio-driven avatars, swap the muted `<audio>`
  in `App.jsx` for that flow and drop the text-based `speak()` call.
- **Data store**: `utils/store.js` is a JSON file for easy local testing —
  point it at Postgres/Mongo before handling real user data.
- **Rate limiting / abuse**: basic `express-rate-limit` is applied to chat
  and admin-verify; tune the limits for your expected traffic.
