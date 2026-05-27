const { clearCookie, sendJson } = require('../_lib/http');
const { COOKIE_NAME } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  clearCookie(res, COOKIE_NAME);
  sendJson(res, 200, { data: { ok: true } });
};
