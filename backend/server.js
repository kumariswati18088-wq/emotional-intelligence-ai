require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

// Gracefully resolve JWT_SECRET from SESSION_SECRET if not set explicitly.
if (!process.env.JWT_SECRET && process.env.SESSION_SECRET) {
  process.env.JWT_SECRET = process.env.SESSION_SECRET;
}
// Default admin password so the server doesn't crash without a .env file.
if (!process.env.ADMIN_SECRET_PASSWORD) {
  process.env.ADMIN_SECRET_PASSWORD = "Rounak@7573";
}
// Abort only when truly unrecoverable.
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not set. Provide SESSION_SECRET or JWT_SECRET.");
  process.exit(1);
}

const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const heygenRoutes = require("./routes/heygen");
const adminRoutes = require("./routes/admin");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/heygen", heygenRoutes);
app.use("/api/admin", adminRoutes);

// Central error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: "Internal server error" });
});

const PORT = process.env.BACKEND_PORT || 5000;
const path = require('path');

// Frontend ke build folder ko serve karne ke liye
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Har route par frontend index.html bhejne ke liye
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`EI Companion backend listening on port ${PORT}`);
});


