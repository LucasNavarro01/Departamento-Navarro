const { sendJson } = require('../_lib/http');
const { requireSession } = require('../_lib/auth');
const { restSelect } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const auth = await requireSession(req, res);
  if (!auth) return sendJson(res, 401, { error: 'No autenticado' });

  try {
    const rows = await restSelect(
      'reservations',
      `select=*&user_id=eq.${encodeURIComponent(auth.user.id)}&order=created_at.desc&limit=20`
    );
    sendJson(res, 200, { data: rows });
  } catch (error) {
    sendJson(res, 200, { data: [] });
  }
};
