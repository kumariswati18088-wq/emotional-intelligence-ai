const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { readDb, writeDb } = require("../utils/store");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function signUserToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      isAdmin: false,
      isGuest: !!user.isGuest,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

// POST /api/auth/guest
// Guest session does NOT depend on writing to db.json.
// This is important for Vercel/serverless deployment.
router.post("/guest", (_req, res) => {
  const guestUser = {
    id: "guest",
    username: "guest",
    avatar: "GIRL1",
    voice: "GIGI",
    language: "en",
    isGuest: true,
  };

  const token = signUserToken(guestUser);

  res.json({
    token,
    user: guestUser,
  });
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters" });
  }

  const db = readDb();

  const exists = db.users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );

  if (exists) {
    return res.status(409).json({ error: "Username already taken" });
  }

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

  res.json({
    token,
    user: publicUser(newUser),
  });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const db = readDb();

  const user = db.users.find(
    (u) =>
      u.username.toLowerCase() === (username || "").toLowerCase()
  );

  if (!user) {
    return res
      .status(401)
      .json({ error: "Invalid username or password" });
  }

  const valid = await bcrypt.compare(
    password || "",
    user.passwordHash
  );

  if (!valid) {
    return res
      .status(401)
      .json({ error: "Invalid username or password" });
  }

  const token = signUserToken(user);

  res.json({
    token,
    user: publicUser(user),
  });
});

// POST /api/auth/google - verify Google Identity Services credential server-side.
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body || {};
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(503).json({ error: "Google login is not configured yet. Add GOOGLE_CLIENT_ID to backend and VITE_GOOGLE_CLIENT_ID to frontend." });
    if (!credential) return res.status(400).json({ error: "Google credential is missing." });
    const response = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential));
    if (!response.ok) return res.status(401).json({ error: "Google sign-in could not be verified. Please try again." });
    const profile = await response.json();
    if (profile.aud !== clientId || profile.email_verified !== "true" || !profile.sub) return res.status(401).json({ error: "Google account verification failed." });
    const user = { id: "google_" + profile.sub, username: profile.email, email: profile.email, name: profile.name || profile.email, avatar: "GIRL1", voice: "GIGI", language: "en", isGoogle: true };
    const token = jwt.sign({ id: user.id, username: user.username, isAdmin: false, isGuest: false, isGoogle: true, email: user.email, name: user.name, avatar: user.avatar, voice: user.voice, language: user.language }, process.env.JWT_SECRET, { expiresIn: "7d" });
    return res.json({ token, user });
  } catch (error) {
    console.error("Google login failed:", error);
    return res.status(502).json({ error: "Google sign-in is temporarily unavailable. Please try again." });
  }
});
// GET /api/auth/me
router.get("/me", requireAuth, (req, res) => {
  // Guest users do not exist in db.json.
  // Recover guest session directly from the JWT.
  if (req.user.isGoogle && req.user.id.startsWith("google_")) {
    return res.json({ user: { id: req.user.id, username: req.user.username, email: req.user.email, name: req.user.name, avatar: req.user.avatar || "GIRL1", voice: req.user.voice || "GIGI", language: req.user.language || "en", isGoogle: true } });
  }
  if (req.user.isGuest && req.user.id === "guest") {
    return res.json({
      user: {
        id: "guest",
        username: "guest",
        avatar: "GIRL1",
        voice: "GIGI",
        language: "en",
        isGuest: true,
      },
    });
  }

  const db = readDb();

  const user = db.users.find((u) => u.id === req.user.id);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({
    user: publicUser(user),
  });
});

// PUT /api/auth/profile
router.put("/profile", requireAuth, async (req, res) => {
  // Guest profile is kept client-side for now.
  // Do not try to write guest data to Vercel's filesystem.
  if (req.user.isGuest && req.user.id === "guest") {
    const {
      username,
      avatar,
      voice,
      language,
    } = req.body;

    const guestUser = {
      id: "guest",
      username: username || "guest",
      avatar: avatar || "GIRL1",
      voice: voice || "GIGI",
      language: language || "en",
      isGuest: true,
    };

    const token = signUserToken(guestUser);

    return res.json({
      token,
      user: guestUser,
    });
  }

  const db = readDb();

  const user = db.users.find((u) => u.id === req.user.id);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const {
    username,
    password,
    avatar,
    voice,
    language,
  } = req.body;

  if (username && username !== user.username) {
    const taken = db.users.some(
      (u) =>
        u.id !== user.id &&
        u.username.toLowerCase() === username.toLowerCase()
    );

    if (taken) {
      return res.status(409).json({
        error: "Username already taken",
      });
    }

    user.username = username;
  }

  if (password) {
    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
  }

  if (avatar) user.avatar = avatar;
  if (voice) user.voice = voice;
  if (language) user.language = language;

  writeDb(db);

  const token = signUserToken(user);

  res.json({
    token,
    user: publicUser(user),
  });
});

module.exports = router;
