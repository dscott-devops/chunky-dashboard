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
import { log, requestLogger } from './logger.js';

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
  DEBUG,
} = process.env;

if (!JWT_SECRET || !PROD_API_URL || !DEV_API_URL) {
  log.error('Missing required env vars: JWT_SECRET, PROD_API_URL, DEV_API_URL');
  process.exit(1);
}

// --- TOTP secret store (file-backed) ---
function loadSecrets() {
  try {
    const secrets = JSON.parse(fs.readFileSync(TOTP_STORE, 'utf8'));
    log.debug(`Loaded TOTP secrets from ${TOTP_STORE} (${Object.keys(secrets).length} entries)`);
    return secrets;
  } catch {
    log.debug('No TOTP secrets file found, starting fresh');
    return {};
  }
}
function saveSecrets(secrets) {
  fs.mkdirSync(path.dirname(TOTP_STORE), { recursive: true });
  fs.writeFileSync(TOTP_STORE, JSON.stringify(secrets, null, 2), 'utf8');
  log.debug(`Saved TOTP secrets to ${TOTP_STORE} (${Object.keys(secrets).length} entries)`);
}

// --- Middleware ---
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { ok: false, code: 'RATE_LIMITED', message: 'Too many login attempts' },
});

function requireAuth(req, res, next) {
  const token = req.cookies?.admin_token;
  if (!token) {
    log.auth(`[${req.reqId}] No admin_token cookie — UNAUTHENTICATED`);
    return res.status(401).json({ ok: false, code: 'UNAUTHENTICATED' });
  }
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    log.auth(`[${req.reqId}] Token valid — user ${req.admin.email} env=${req.admin.env}`);
    next();
  } catch (err) {
    log.auth(`[${req.reqId}] Token invalid: ${err.message}`);
    res.clearCookie('admin_token');
    res.status(401).json({ ok: false, code: 'TOKEN_EXPIRED' });
  }
}

// --- Auth routes ---
app.post('/auth/login', loginLimiter, async (req, res) => {
  const { email, password, totp_code, env = 'prod' } = req.body;
  log.auth(`[${req.reqId}] Login attempt — email=${email} env=${env} totp_present=${!!totp_code}`);

  if (!email || !password) {
    log.auth(`[${req.reqId}] Missing credentials`);
    return res.status(400).json({ ok: false, code: 'MISSING_CREDENTIALS' });
  }

  const apiBase = env === 'dev' ? DEV_API_URL : PROD_API_URL;
  log.auth(`[${req.reqId}] Validating credentials against ${apiBase}`);

  let apiRes, apiBody;
  try {
    apiRes = await fetch(`${apiBase}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    apiBody = await apiRes.json();
    log.auth(`[${req.reqId}] API response status=${apiRes.status} ok=${apiBody.ok} userId=${apiBody.user?.id}`);
  } catch (err) {
    log.error(`[${req.reqId}] API unreachable: ${err.message}`);
    return res.status(502).json({ ok: false, code: 'API_UNREACHABLE', message: err.message });
  }

  if (!apiRes.ok || !apiBody.ok) {
    log.auth(`[${req.reqId}] Invalid credentials — API returned ${apiRes.status}`);
    return res.status(401).json({ ok: false, code: 'INVALID_CREDENTIALS' });
  }

  if (!apiBody.user?.admin) {
    log.auth(`[${req.reqId}] User ${email} is not admin (admin=${apiBody.user?.admin})`);
    return res.status(403).json({ ok: false, code: 'NOT_ADMIN' });
  }

  const userId = apiBody.user.id;
  const secrets = loadSecrets();
  log.totp(`[${req.reqId}] Checking TOTP for userId=${userId} enrolled=${!!secrets[userId]} pending=${!!secrets[`pending_${userId}`]}`);

  // TOTP enrollment: first login for this user
  if (!secrets[userId]) {
    if (!totp_code) {
      log.totp(`[${req.reqId}] No TOTP secret for user — generating enrollment QR`);
      const totp = new OTPAuth.TOTP({
        issuer: TOTP_ISSUER,
        label: email,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: new OTPAuth.Secret(),
      });
      secrets[`pending_${userId}`] = totp.secret.base32;
      saveSecrets(secrets);
      log.totp(`[${req.reqId}] Enrollment initiated — pending secret stored for userId=${userId}`);
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
      log.totp(`[${req.reqId}] No pending enrollment found for userId=${userId}`);
      return res.status(400).json({ ok: false, code: 'NO_PENDING_ENROLLMENT' });
    }
    log.totp(`[${req.reqId}] Confirming enrollment for userId=${userId}`);
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
      log.totp(`[${req.reqId}] Enrollment TOTP verification FAILED for userId=${userId}`);
      return res.status(401).json({ ok: false, code: 'INVALID_TOTP' });
    }
    secrets[userId] = pendingSecret;
    delete secrets[`pending_${userId}`];
    saveSecrets(secrets);
    log.totp(`[${req.reqId}] Enrollment confirmed for userId=${userId} delta=${delta}`);
  } else {
    // Normal TOTP verification
    if (!totp_code) {
      log.totp(`[${req.reqId}] TOTP required but not provided for userId=${userId}`);
      return res.status(400).json({ ok: false, code: 'TOTP_REQUIRED', action: 'totp' });
    }
    log.totp(`[${req.reqId}] Verifying TOTP for userId=${userId}`);
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
      log.totp(`[${req.reqId}] TOTP verification FAILED for userId=${userId}`);
      return res.status(401).json({ ok: false, code: 'INVALID_TOTP' });
    }
    log.totp(`[${req.reqId}] TOTP verified for userId=${userId} delta=${delta}`);
  }

  const token = jwt.sign(
    { userId, email, role: 'admin', env, apiToken: apiBody.token },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  log.auth(`[${req.reqId}] JWT issued for userId=${userId} email=${email} env=${env} expires=24h`);

  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: false, // TLS terminates at upstream proxy; forwarded over HTTP on LAN
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
  });

  log.info(`Login success — ${email} (userId=${userId}) env=${env}`);
  res.json({ ok: true, email, env });
});

app.post('/auth/logout', (req, res) => {
  const email = req.cookies?.admin_token
    ? (() => { try { return jwt.decode(req.cookies.admin_token)?.email; } catch { return 'unknown'; } })()
    : 'unknown';
  log.auth(`[${req.reqId}] Logout — ${email}`);
  res.clearCookie('admin_token');
  res.json({ ok: true });
});

app.get('/auth/me', requireAuth, (req, res) => {
  const { userId, email, env } = req.admin;
  log.auth(`[${req.reqId}] /auth/me — userId=${userId} email=${email} env=${env}`);
  res.json({ ok: true, userId, email, env });
});

// --- API proxy ---
app.use('/api', requireAuth, async (req, res) => {
  const apiBase = req.admin.env === 'dev' ? DEV_API_URL : PROD_API_URL;
  const upstream = `${apiBase}${req.originalUrl}`;

  log.proxy(`[${req.reqId}] ${req.method} ${req.originalUrl} → ${upstream}`);

  try {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${req.admin.apiToken}`,
    };

    const fetchOpts = { method: req.method, headers };

    if (!['GET', 'HEAD'].includes(req.method) && req.body && Object.keys(req.body).length) {
      fetchOpts.body = JSON.stringify(req.body);
      log.proxy(`[${req.reqId}] Request body: ${fetchOpts.body}`);
    }

    const upstream_res = await fetch(upstream, fetchOpts);
    const body = await upstream_res.text();

    log.proxy(`[${req.reqId}] Upstream responded ${upstream_res.status} (${body.length} bytes)`);
    if (upstream_res.status >= 400) {
      log.warn(`[${req.reqId}] Upstream error ${upstream_res.status}: ${body.slice(0, 200)}`);
    }
    log.debug(`[${req.reqId}] Response body: ${body.slice(0, 500)}`);

    res.status(upstream_res.status);
    upstream_res.headers.forEach((val, key) => {
      if (!['transfer-encoding', 'connection', 'content-encoding', 'content-length'].includes(key.toLowerCase())) {
        res.setHeader(key, val);
      }
    });
    res.send(body);
  } catch (err) {
    log.error(`[${req.reqId}] Upstream fetch failed: ${err.message}`);
    res.status(502).json({ ok: false, code: 'UPSTREAM_ERROR', message: err.message });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  log.info(`Chunky admin proxy listening on 127.0.0.1:${PORT}`);
  log.info(`Debug mode: ${DEBUG === 'true' ? 'ON' : 'OFF'}`);
  log.info(`Prod API: ${PROD_API_URL}`);
  log.info(`Dev API:  ${DEV_API_URL}`);
  log.info(`TOTP store: ${TOTP_STORE}`);
});
