const { restUpsert } = require('./_lib/supabase');
const { checkAdminAuth } = require('./_lib/admin-auth');
const ALLOWED_KEYS = new Set([
  'price_per_night',
  'price_extra_person',
  'price_by_guests',
  'min_nights_low',
  'phone',
  'is_closed',
  'closed_message',
  'amenities',
  'photos'
]);

function send(res, status, body) {
  res.status(status).json(body);
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (typeof req.body === 'string') {
    return req.body ? JSON.parse(req.body) : {};
  }

  if (Buffer.isBuffer(req.body)) {
    const rawBody = req.body.toString('utf8');
    return rawBody ? JSON.parse(rawBody) : {};
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) : {};
}

async function upsertConfig(key, value) {
  await restUpsert('property_config', [{
    key,
    value,
    updated_at: new Date().toISOString()
  }], 'key');
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    send(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await readBody(req);
    const { key, value } = body;

    const auth = checkAdminAuth(req, body);
    if (!auth.ok) {
      if (auth.retryAfter) res.setHeader('Retry-After', String(auth.retryAfter));
      send(res, auth.status, { error: auth.message });
      return;
    }

    if (key === 'ping') {
      send(res, 200, { ok: true });
      return;
    }

    if (!ALLOWED_KEYS.has(key)) {
      send(res, 400, { error: 'Invalid key' });
      return;
    }

    await upsertConfig(key, value);
    send(res, 200, { ok: true });
  } catch (error) {
    console.error('update-config error:', error);
    send(res, 500, { error: 'No se pudo actualizar la configuración' });
  }
};
