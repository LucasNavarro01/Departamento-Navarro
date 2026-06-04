const { sendJson } = require('../_lib/http');
const { requireSession } = require('../_lib/auth');
const { buildCouponCode } = require('../_lib/coupons');

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
      tier: auth.tier.key,
      label: auth.tier.label,
      percent: auth.tier.percent,
      code: buildCouponCode(auth.user, auth.tier),
      count: auth.reservationCount,
      reservationCount: auth.reservationCount,
      nextTier: auth.tier.next
    }
  });
};
