const DEBUG = process.env.DEBUG === 'true';

const RESET  = '\x1b[0m';
const DIM    = '\x1b[2m';
const CYAN   = '\x1b[36m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const MAGENTA= '\x1b[35m';
const BLUE   = '\x1b[34m';

function ts() {
  return DIM + new Date().toISOString() + RESET;
}

function label(tag, color) {
  return color + `[${tag}]` + RESET;
}

export const log = {
  info:    (...args) => console.log(ts(), label('INFO',    GREEN),   ...args),
  warn:    (...args) => console.warn(ts(), label('WARN',   YELLOW),  ...args),
  error:   (...args) => console.error(ts(), label('ERROR', RED),     ...args),

  // Debug-only — all verbose logging goes through these
  req:     (...args) => DEBUG && console.log(ts(), label('REQUEST',  CYAN),    ...args),
  auth:    (...args) => DEBUG && console.log(ts(), label('AUTH',     MAGENTA), ...args),
  totp:    (...args) => DEBUG && console.log(ts(), label('TOTP',     YELLOW),  ...args),
  proxy:   (...args) => DEBUG && console.log(ts(), label('PROXY',    BLUE),    ...args),
  debug:   (...args) => DEBUG && console.log(ts(), label('DEBUG',    DIM),     ...args),
};

export function requestLogger(req, res, next) {
  const id = Math.random().toString(36).slice(2, 9);
  req.reqId = id;
  const start = Date.now();

  if (DEBUG) {
    log.req(`${req.method} ${req.originalUrl} [${id}]`);
    if (req.body && Object.keys(req.body).length) {
      const safe = { ...req.body };
      if (safe.password) safe.password = '***';
      if (safe.totp_code) safe.totp_code = '***';
      log.req(`  body:`, JSON.stringify(safe));
    }
  }

  res.on('finish', () => {
    const ms = Date.now() - start;
    const color = res.statusCode >= 500 ? RED : res.statusCode >= 400 ? YELLOW : GREEN;
    if (DEBUG) {
      log.req(`${color}${res.statusCode}${RESET} ${req.method} ${req.originalUrl} [${id}] ${ms}ms`);
    } else if (res.statusCode >= 400) {
      log.warn(`${res.statusCode} ${req.method} ${req.originalUrl} ${ms}ms`);
    }
  });

  next();
}
