const { readBody } = require('./_lib/http');
const { restDelete, restInsert, restSelect } = require('./_lib/supabase');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function send(res, status, body) {
  res.status(status).json(body);
}

function isValidDateKey(value) {
  if (!DATE_RE.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function hasValidPassword(password) {
  return Boolean(process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD);
}

async function listBlockedDates(req, res) {
  if (!hasValidPassword(req.query.password)) {
    return send(res, 401, { error: 'Unauthorized' });
  }

  const rows = await restSelect(
    'blocked_dates',
    'select=id,start_date,end_date,reason&order=start_date.asc'
  );
  return send(res, 200, { data: rows });
}

async function createBlockedDate(req, res) {
  const body = await readBody(req);
  const startDate = body.start_date;
  const endDate = body.end_date;
  const reason = typeof body.reason === 'string' && body.reason.trim()
    ? body.reason.trim()
    : null;

  if (!hasValidPassword(body.password)) {
    return send(res, 401, { error: 'Unauthorized' });
  }

  if (!isValidDateKey(startDate) || !isValidDateKey(endDate)) {
    return send(res, 400, { error: 'Las fechas deben tener formato YYYY-MM-DD' });
  }

  if (startDate >= endDate) {
    return send(res, 400, { error: 'La fecha hasta debe ser posterior a la fecha desde' });
  }

  const inserted = await restInsert('blocked_dates', [{
    start_date: startDate,
    end_date: endDate,
    reason
  }]);

  return send(res, 200, { ok: true, data: inserted[0] });
}

async function deleteBlockedDate(req, res) {
  if (!hasValidPassword(req.query.password)) {
    return send(res, 401, { error: 'Unauthorized' });
  }

  if (!req.query.id) {
    return send(res, 400, { error: 'Falta el id del bloqueo' });
  }

  await restDelete('blocked_dates', `id=eq.${encodeURIComponent(req.query.id)}`);
  return send(res, 200, { ok: true });
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') return await listBlockedDates(req, res);
    if (req.method === 'POST') return await createBlockedDate(req, res);
    if (req.method === 'DELETE') return await deleteBlockedDate(req, res);

    res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS');
    return send(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return send(res, 500, { error: error.message || 'No se pudieron gestionar las fechas' });
  }
};
