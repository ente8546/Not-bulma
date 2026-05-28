import express from "express";
import crypto from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
const PORT = process.env.PORT || 3000;
const DEFAULT_PASSWORD = "admin123";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const app = express();
app.use(express.json());

app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

function getLocalIPv4Addresses() {
  const ips = [];
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    if (!iface) continue;
    for (const net of iface) {
      const isIPv4 = net.family === "IPv4" || net.family === 4;
      if (isIPv4 && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return [...new Set(ips)];
}

function getNetworkUrls() {
  return getLocalIPv4Addresses().map((ip) => `http://${ip}:${PORT}`);
}

function printStartupUrls() {
  const hosts = getNetworkUrls();
  console.log("");
  console.log("=== Bu bilgisayar (PC) ===");
  console.log(`  http://localhost:${PORT}`);
  console.log(`  http://127.0.0.1:${PORT}`);
  if (hosts.length === 0) {
    console.log("");
    console.log("=== Telefon / tablet ===");
    console.log("  Wi-Fi IP bulunamadı. ipconfig ile IPv4 adresinize bakın.");
    console.log("  Güvenlik duvarı: scripts\\open-firewall.ps1 (Yönetici olarak)");
  } else {
    console.log("");
    console.log("=== Telefon / tablet (aynı Wi-Fi) ===");
    for (const url of hosts) {
      console.log(`  ${url}`);
      console.log(`  ${url}/admin.html  (admin)`);
    }
    console.log("");
    console.log("Telefonda localhost YAZMAYIN — yukarıdaki 192.168... adresini kullanın.");
    console.log("Açılmazsa: scripts\\open-firewall.ps1 dosyasına sağ tık → Yönetici olarak çalıştır");
  }
  console.log("");
}

const sessions = new Map();
const sseClients = new Set();

function randomSalt(length = 16) {
  return crypto.randomBytes(length).toString("hex");
}

function hashPassword(password, salt) {
  return crypto
    .createHash("sha256")
    .update(String(password) + salt)
    .digest("hex");
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function loadSessions() {
  try {
    const raw = await fs.readFile(SESSIONS_FILE, "utf8");
    const list = JSON.parse(raw);
    const now = Date.now();
    for (const [token, meta] of list) {
      if (now - meta.createdAt < SESSION_MAX_AGE_MS) {
        sessions.set(token, meta);
      }
    }
  } catch (err) {
    if (err.code !== "ENOENT") console.error("Oturum yükleme:", err);
  }
}

async function saveSessions() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(
    SESSIONS_FILE,
    JSON.stringify([...sessions.entries()], null, 2),
    "utf8"
  );
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const meta = token ? sessions.get(token) : null;
  if (!meta || Date.now() - meta.createdAt >= SESSION_MAX_AGE_MS) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: "Oturum geçersiz. Tekrar giriş yapın." });
  }
  req.adminToken = token;
  next();
}

async function readStore() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

async function writeStore(store) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

async function ensureStore() {
  let store = await readStore();
  if (!store) {
    const salt = randomSalt();
    store = {
      admin: {
        passwordHash: hashPassword(DEFAULT_PASSWORD, salt),
        passwordSalt: salt,
        grade: null,
      },
      puzzle: null,
    };
    await writeStore(store);
  }
  return store;
}

function broadcastPuzzle(puzzle) {
  const payload = JSON.stringify(puzzle);
  for (const res of sseClients) {
    res.write(`data: ${payload}\n\n`);
  }
}

function publicPuzzle(store) {
  if (!store?.puzzle) return null;
  const { type, subType, question, choices, salt, answerHash, updatedAt } = store.puzzle;
  return {
    type,
    subType: subType ?? null,
    question,
    choices: choices ?? null,
    salt,
    answerHash,
    updatedAt,
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/server-info", (req, res) => {
  const hosts = getNetworkUrls();
  const proto = req.protocol;
  const hostHeader = req.get("host") || `localhost:${PORT}`;
  res.json({
    port: PORT,
    hosts,
    local: `http://localhost:${PORT}`,
    currentOrigin: `${proto}://${hostHeader}`,
    onLocalhost:
      req.hostname === "localhost" || req.hostname === "127.0.0.1",
  });
});

app.get("/api/puzzle", async (_req, res) => {
  try {
    const store = await ensureStore();
    res.json(publicPuzzle(store));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

app.get("/api/puzzle/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const store = await ensureStore();
    res.write(`data: ${JSON.stringify(publicPuzzle(store))}\n\n`);
  } catch (err) {
    console.error(err);
  }

  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

app.post("/api/admin/login", async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: "Şifre gerekli" });
    }

    const store = await ensureStore();
    const { passwordHash, passwordSalt, grade } = store.admin;
    const hash = hashPassword(password, passwordSalt);

    if (hash !== passwordHash) {
      return res.status(401).json({ error: "Yanlış şifre" });
    }

    const token = createToken();
    sessions.set(token, { createdAt: Date.now() });
    await saveSessions();

    res.json({ token, grade, isDefault: password === DEFAULT_PASSWORD });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

app.get("/api/admin/config", authMiddleware, async (_req, res) => {
  try {
    const store = await readStore();
    res.json({ grade: store?.admin?.grade ?? null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

app.put("/api/admin/grade", authMiddleware, async (req, res) => {
  try {
    const grade = parseInt(String(req.body?.grade ?? ""), 10);
    const puzzle = req.body?.puzzle;

    if (Number.isNaN(grade) || grade < 0 || grade > 100) {
      return res.status(400).json({ error: "Not 0–100 arasında tam sayı olmalıdır" });
    }
    if (!puzzle?.question || !puzzle?.answerHash || !puzzle?.salt) {
      return res.status(400).json({ error: "Bulmaca verisi eksik. Sayfayı yenileyip tekrar deneyin." });
    }

    const store = await ensureStore();
    store.admin.grade = grade;
    store.puzzle = {
      type: puzzle.type,
      subType: puzzle.subType ?? null,
      question: puzzle.question,
      choices: puzzle.choices ?? null,
      salt: puzzle.salt,
      answerHash: puzzle.answerHash,
      updatedAt: new Date().toISOString(),
    };
    await writeStore(store);

    const pub = publicPuzzle(store);
    broadcastPuzzle(pub);
    res.json({ ok: true, grade, puzzle: pub });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

app.put("/api/admin/password", authMiddleware, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword ?? "").trim();
    const newPassword = String(req.body?.newPassword ?? "").trim();

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Mevcut ve yeni şifre gerekli" });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ error: "Yeni şifre en az 4 karakter olmalı" });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: "Yeni şifre mevcut şifreden farklı olmalı" });
    }

    const store = await ensureStore();
    const hash = hashPassword(currentPassword, store.admin.passwordSalt);
    if (hash !== store.admin.passwordHash) {
      return res.status(400).json({ error: "Mevcut şifre yanlış" });
    }

    const salt = randomSalt();
    store.admin.passwordHash = hashPassword(newPassword, salt);
    store.admin.passwordSalt = salt;
    await writeStore(store);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

app.use(express.static(__dirname));

Promise.all([ensureStore(), loadSessions()]).then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Not Bulmaca — port ${PORT}`);
    console.log(`Varsayılan admin şifresi: ${DEFAULT_PASSWORD}`);
    printStartupUrls();
  });
});
