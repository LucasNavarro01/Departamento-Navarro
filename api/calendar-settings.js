const { readBody } = require('./_lib/http');
const { restDelete, restInsert, restSelect } = require('./_lib/supabase');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function send(res, status, body) {
  res.status(status).json(body);
}

function hasValidPassword(password) {
  return Boolean(process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD);
}

function isValidDateKey(value) {
  if (!DATE_RE.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeInt(value, fallback = null) {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

async function readOverlaps(table, startDate, endDate, select = '*') {
  return restSelect(
    table,
    [
      `select=${select}`,
      `start_date=lt.${encodeURIComponent(endDate)}`,
      `end_date=gt.${encodeURIComponent(startDate)}`,
      'order=start_date.asc'
    ].join('&')
  );
}

async function replaceRange(table, startDate, endDate, newRows, preserveRow) {
  const overlaps = await readOverlaps(table, startDate, endDate);

  for (const row of overlaps) {
    await restDelete(table, `id=eq.${encodeURIComponent(row.id)}`);
  }

  const remainderRows = overlaps.flatMap(row => {
    const preserved = preserveRow(row);
    const parts = [];
    if (row.start_date < startDate) {
      parts.push({ ...preserved, start_date: row.start_date, end_date: startDate });
    }
    if (row.end_date > endDate) {
      parts.push({ ...preserved, start_date: endDate, end_date: row.end_date });
    }
    return parts.filter(part => part.start_date < part.end_date);
  });

  const rows = [...remainderRows, ...newRows].filter(row => row.start_date < row.end_date);
  if (rows.length > 0) {
    await restInsert(table, rows);
  }
}

async function listSettings(req, res) {
  if (!hasValidPassword(req.query.password)) {
    return send(res, 401, { error: 'Unauthorized' });
  }

  const [blockedDates, rules] = await Promise.all([
    restSelect('blocked_dates', 'select=id,start_date,end_date,reason&order=start_date.asc'),
    restSelect('calendar_rules', 'select=id,start_date,end_date,price_per_night,min_nights&order=start_date.asc')
  ]);

  return send(res, 200, { data: { blockedDates, rules } });
}

async function applySettings(req, res) {
  const body = await readBody(req);

  if (!hasValidPassword(body.password)) {
    return send(res, 401, { error: 'Unauthorized' });
  }

  if (!isValidDateKey(body.start_date) || !isValidDateKey(body.end_date)) {
    return send(res, 400, { error: 'Las fechas deben tener formato YYYY-MM-DD' });
  }

  if (body.start_date >= body.end_date) {
    return send(res, 400, { error: 'La fecha hasta debe ser posterior a la fecha desde' });
  }

  const startDate = body.start_date;
  const endDate = body.end_date;
  const isAvailable = Boolean(body.is_available);
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null;
  const pricePerNight = normalizeInt(body.price_per_night);
  const minNights = Math.max(1, normalizeInt(body.min_nights, 1));

  await replaceRange(
    'blocked_dates',
    startDate,
    endDate,
    isAvailable ? [] : [{ start_date: startDate, end_date: endDate, reason }],
    row => ({ reason: row.reason || null })
  );

  if (pricePerNight !== null || minNights !== null) {
    await replaceRange(
      'calendar_rules',
      startDate,
      endDate,
      [{ start_date: startDate, end_date: endDate, price_per_night: pricePerNight, min_nights: minNights }],
      row => ({ price_per_night: row.price_per_night, min_nights: Math.max(1, Number(row.min_nights || 1)) })
    );
  }

  return send(res, 200, { ok: true });
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') return await listSettings(req, res);
    if (req.method === 'POST') return await applySettings(req, res);

    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return send(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return send(res, 500, { error: error.message || 'No se pudo actualizar el calendario' });
  }
};
