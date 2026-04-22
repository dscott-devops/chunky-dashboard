import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import * as OTPAuth from 'otpauth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1); // traffic arrives via nginx reverse proxy

const {
  JWT_SECRET,
  PROD_API_URL,
  DEV_API_URL,
  PORT = 3020,
  TOTP_ISSUER = 'ChunkySports',
  TOTP_STORE = path.join(__dirname, 'data/totp_secrets.json'),
} = process.env;

if (!JWT_SECRET || !PROD_API_URL || !DEV_API_URL) {
  console.error('Missing required env vars: JWT_SECRET, PROD_API_URL, DEV_API_URL');
  process.exit(1);
}

// --- TOTP secret store (file-backed) ---
function loadSecrets() {
  try { return JSON.parse(fs.readFileSync(TOTP_STORE, 'utf8')); }
  catch { return {}; }
}
function saveSecrets(secrets) {
  fs.mkdirSync(path.dirname(TOTP_STORE), { recursive: true });
  fs.writeFileSync(TOTP_STORE, JSON.stringify(secrets, null, 2), 'utf8');
}

// --- Middleware ---
app.use(express.json());
app.use(cookieParser());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { ok: false, code: 'RATE_LIMITED', message: 'Too many login attempts' },
});

function requireAuth(req, res, next) {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ ok: false, code: 'UNAUTHENTICATED' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.clearCookie('admin_token');
    res.status(401).json({ ok: false, code: 'TOKEN_EXPIRED' });
  }
}

// --- Auth routes ---
app.post('/auth/login', loginLimiter, async (req, res) => {
  const { email, password, totp_code, env = 'prod' } = req.body;
  if (!email || !password) {
    return res.status(400).json({ ok: false, code: 'MISSING_CREDENTIALS' });
  }

  const apiBase = env === 'dev' ? DEV_API_URL : PROD_API_URL;

  // Validate credentials against the API
  let apiRes, apiBody;
  try {
    apiRes = await fetch(`${apiBase}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    apiBody = await apiRes.json();
  } catch (err) {
    return res.status(502).json({ ok: false, code: 'API_UNREACHABLE', message: err.message });
  }

  if (!apiRes.ok || !apiBody.ok) {
    return res.status(401).json({ ok: false, code: 'INVALID_CREDENTIALS' });
  }

  // Verify user is admin
  if (!apiBody.user?.admin) {
    return res.status(403).json({ ok: false, code: 'NOT_ADMIN' });
  }

  const userId = apiBody.user.id;
  const secrets = loadSecrets();

  // TOTP enrollment: first login for this user
  if (!secrets[userId]) {
    if (!totp_code) {
      // Generate new secret and return QR uri for enrollment
      const totp = new OTPAuth.TOTP({
        issuer: TOTP_ISSUER,
        label: email,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: new OTPAuth.Secret(),
      });
      // Store pending (not yet confirmed)
      secrets[`pending_${userId}`] = totp.secret.base32;
      saveSecrets(secrets);
      return res.json({
        ok: true,
        action: 'enroll',
        totp_uri: totp.toString(),
        message: 'Scan QR code then re-submit with totp_code to complete enrollment',
      });
    }

    // Confirm enrollment
    const pendingSecret = secrets[`pending_${userId}`];
    if (!pendingSecret) {
      return res.status(400).json({ ok: false, code: 'NO_PENDING_ENROLLMENT' });
    }
    const totp = new OTPAuth.TOTP({
      issuer: TOTP_ISSUER,
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(pendingSecret),
    });
    const delta = totp.validate({ token: totp_code, window: 1 });
    if (delta === null) {
      return res.status(401).json({ ok: false, code: 'INVALID_TOTP' });
    }
    secrets[userId] = pendingSecret;
    delete secrets[`pending_${userId}`];
    saveSecrets(secrets);
  } else {
    // Normal TOTP verification
    if (!totp_code) {
      return res.status(400).json({ ok: false, code: 'TOTP_REQUIRED', action: 'totp' });
    }
    const totp = new OTPAuth.TOTP({
      issuer: TOTP_ISSUER,
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secrets[userId]),
    });
    const delta = totp.validate({ token: totp_code, window: 1 });
    if (delta === null) {
      return res.status(401).json({ ok: false, code: 'INVALID_TOTP' });
    }
  }

  const token = jwt.sign(
    { userId, email, role: 'admin', env, apiToken: apiBody.token },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: false, // TLS terminates at upstream proxy; forwarded over HTTP on LAN
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.json({ ok: true, email, env });
});

app.post('/auth/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ ok: true });
});

app.get('/auth/me', requireAuth, (req, res) => {
  const { userId, email, env } = req.admin;
  res.json({ ok: true, userId, email, env });
});

// --- API proxy ---
// All /api/* calls are forwarded to the appropriate upstream with the stored Bearer token
app.use('/api', requireAuth, async (req, res) => {
  const apiBase = req.admin.env === 'dev' ? DEV_API_URL : PROD_API_URL;
  const upstream = `${apiBase}${req.originalUrl}`;

  try {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${req.admin.apiToken}`,
    };

    const fetchOpts = {
      method: req.method,
      headers,
    };

    if (!['GET', 'HEAD'].includes(req.method) && req.body && Object.keys(req.body).length) {
      fetchOpts.body = JSON.stringify(req.body);
    }

    const upstream_res = await fetch(upstream, fetchOpts);
    const body = await upstream_res.text();

    res.status(upstream_res.status);
    upstream_res.headers.forEach((val, key) => {
      if (!['transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        res.setHeader(key, val);
      }
    });
    res.send(body);
  } catch (err) {
    res.status(502).json({ ok: false, code: 'UPSTREAM_ERROR', message: err.message });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Chunky admin proxy listening on 127.0.0.1:${PORT}`);
});
