const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { readDb, writeDb } = require("../utils/store");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function signUserToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, isAdmin: false },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const db = readDb();
  const exists = db.users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );
  if (exists) return res.status(409).json({ error: "Username already taken" });

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = {
    id: uuidv4(),
    username,
    passwordHash,
    avatar: "GIRL1",
    voice: "GIGI",
    language: "en",
    createdAt: new Date().toISOString(),
  };
  db.users.push(newUser);
  writeDb(db);

  const token = signUserToken(newUser);
  res.json({ token, user: publicUser(newUser) });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const db = readDb();
  const user = db.users.find(
    (u) => u.username.toLowerCase() === (username || "").toLowerCase()
  );
  if (!user) return res.status(401).json({ error: "Invalid username or password" });

  const valid = await bcrypt.compare(password || "", user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid username or password" });

  const token = signUserToken(user);
  res.json({ token, user: publicUser(user) });
});

// GET /api/auth/me
router.get("/me", requireAuth, (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: publicUser(user) });
});

// PUT /api/auth/profile  { username?, password?, avatar?, voice?, language? }
router.put("/profile", requireAuth, async (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const { username, password, avatar, voice, language } = req.body;

  if (username && username !== user.username) {
    const taken = db.users.some(
      (u) => u.id !== user.id && u.username.toLowerCase() === username.toLowerCase()
    );
    if (taken) return res.status(409).json({ error: "Username already taken" });
    user.username = username;
  }
  if (password) {
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    user.passwordHash = await bcrypt.hash(password, 10);
  }
  if (avatar) user.avatar = avatar;
  if (voice) user.voice = voice;
  if (language) user.language = language;

  writeDb(db);
  const token = signUserToken(user); // re-sign in case username changed
  res.json({ token, user: publicUser(user) });
});

module.exports = router;
