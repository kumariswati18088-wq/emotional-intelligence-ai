const express = require("express");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { requireAdmin } = require("../middleware/auth");
const { readDb, writeDb } = require("../utils/store");

const router = express.Router();

// Slow down brute-force attempts against the admin phrase.
const verifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again later." },
});

// POST /api/admin/verify  { phrase }
// Called by the client whenever a chat message exactly matches the
// secret trigger string. Compares against ADMIN_SECRET_PASSWORD on the
// server only — the value never ships in the frontend bundle.
router.post("/verify", verifyLimiter, (req, res) => {
  const { phrase } = req.body;
  if (!phrase || phrase !== process.env.ADMIN_SECRET_PASSWORD) {
    return res.status(403).json({ error: "Invalid admin phrase" });
  }
  const adminToken = jwt.sign({ isAdmin: true }, process.env.JWT_SECRET, {
    expiresIn: "30m",
  });
  res.json({ adminToken });
});

// GET /api/admin/users
router.get("/users", requireAdmin, (req, res) => {
  const db = readDb();
  const users = db.users.map(({ passwordHash, ...rest }) => rest);
  res.json({ users });
});

// PUT /api/admin/users/:id  { avatar?, voice?, language?, username? }
router.put("/users/:id", requireAdmin, (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const { avatar, voice, language, username } = req.body;
  if (avatar) user.avatar = avatar;
  if (voice) user.voice = voice;
  if (language) user.language = language;
  if (username) user.username = username;

  writeDb(db);
  const { passwordHash, ...rest } = user;
  res.json({ user: rest });
});

// DELETE /api/admin/users/:id
router.delete("/users/:id", requireAdmin, (req, res) => {
  const db = readDb();
  const before = db.users.length;
  db.users = db.users.filter((u) => u.id !== req.params.id);
  if (db.users.length === before) {
    return res.status(404).json({ error: "User not found" });
  }
  writeDb(db);
  res.json({ success: true });
});

// GET /api/admin/settings
router.get("/settings", requireAdmin, (req, res) => {
  const db = readDb();
  res.json({ settings: db.settings });
});

// PUT /api/admin/settings  { emotionEngines?, defaultAvatar?, defaultVoice?, defaultLanguage?, siteContent? }
router.put("/settings", requireAdmin, (req, res) => {
  const db = readDb();
  const { emotionEngines, defaultAvatar, defaultVoice, defaultLanguage, siteContent } =
    req.body;

  if (emotionEngines) {
    db.settings.emotionEngines = { ...db.settings.emotionEngines, ...emotionEngines };
  }
  if (defaultAvatar) db.settings.defaultAvatar = defaultAvatar;
  if (defaultVoice) db.settings.defaultVoice = defaultVoice;
  if (defaultLanguage) db.settings.defaultLanguage = defaultLanguage;
  if (siteContent) {
    db.settings.siteContent = { ...db.settings.siteContent, ...siteContent };
  }

  writeDb(db);
  res.json({ settings: db.settings });
});

module.exports = router;
