const store = new Map();

function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const hit = store.get(key);

  if (!hit || now > hit.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (hit.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((hit.resetAt - now) / 1000) };
  }

  hit.count += 1;
  return { allowed: true, retryAfter: 0 };
}

function getClientIp(req) {
  const realIp = req.headers['x-real-ip'];
  if (realIp) return Array.isArray(realIp) ? realIp[0] : String(realIp);

  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return String(value).split(',')[0].trim();
  }

  return 'unknown';
}

module.exports = { rateLimit, getClientIp };
