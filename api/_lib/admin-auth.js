const crypto = require('crypto');
const { rateLimit, getClientIp } = require('./rate-limit');

const RATE_LIMIT_BUCKET = 'admin-password';
const RATE_LIMIT_MAX = 8;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

function timingSafeEqualStrings(a, b) {
  const hashA = crypto.createHash('sha256').update(String(a)).digest();
  const hashB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function getAdminPasswordFromRequest(req, body) {
  const header = req.headers['x-admin-password'];
  if (header) return Array.isArray(header) ? header[0] : header;
  return (body && body.password) || '';
}

function isValidAdminPassword(candidate) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !candidate) return false;
  return timingSafeEqualStrings(String(candidate), expected);
}

// Pure check: rate limit first, then password. Never writes to `res` —
// callers apply the result using their own response envelope.
function checkAdminAuth(req, body) {
  const ip = getClientIp(req);
  const limit = rateLimit(`${RATE_LIMIT_BUCKET}:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!limit.allowed) {
    return { ok: false, status: 429, retryAfter: limit.retryAfter, message: 'Demasiados intentos. Intenta mas tarde.' };
  }

  const candidate = getAdminPasswordFromRequest(req, body);
  if (!isValidAdminPassword(candidate)) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }

  return { ok: true };
}

module.exports = { checkAdminAuth, isValidAdminPassword, getAdminPasswordFromRequest, timingSafeEqualStrings };
