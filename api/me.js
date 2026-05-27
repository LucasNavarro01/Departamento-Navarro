const { sendJson } = require('./_lib/http');
const { requireSession } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const auth = await requireSession(req, res);
  if (!auth) return sendJson(res, 401, { error: 'No autenticado' });

  sendJson(res, 200, {
    data: {
      user: auth.user,
      reservationCount: auth.reservationCount,
      tier: auth.tier
    }
  });
};
