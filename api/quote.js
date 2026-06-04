const { sendJson } = require('./_lib/http');
const { requireSession } = require('./_lib/auth');
const { buildQuote } = require('./_lib/pricing');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    const auth = await requireSession(req, res);
    const quote = await buildQuote({
      checkin: req.query.checkin,
      checkout: req.query.checkout,
      guests: req.query.guests,
      discountPct: auth?.tier?.percent || 0
    });

    return sendJson(res, 200, { data: quote });
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'No se pudo calcular el presupuesto' });
  }
};
