// Lightweight file-backed store. Swap this module for a real database
// (Postgres/Mongo) in production — the rest of the app only calls the
// functions exported here, so the storage engine underneath can change
// without touching routes.
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "db.json");

function ensureDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    const initial = {
      users: [],
      settings: {
        emotionEngines: {
          hume: true,
          textFallback: true,
        },
        defaultAvatar: "GIRL1",
        defaultVoice: "GIGI",
        defaultLanguage: "en",
        siteContent: {
          appName: "Aura — Emotional Intelligence Companion",
          welcomeMessage: "Hi, I'm here to listen. How are you feeling today?",
        },
      },
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = { readDb, writeDb };
