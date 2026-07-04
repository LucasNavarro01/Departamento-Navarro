const { sendJson } = require('../_lib/http');
const { requireSession, SessionConfigError } = require('../_lib/auth');
const { restSelect } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  let auth;
  try {
    auth = await requireSession(req, res);
  } catch (error) {
    console.error('reservations/me error:', error);
    if (error instanceof SessionConfigError) {
      return sendJson(res, 503, { error: 'Sesion no configurada. Contacta al administrador.' });
    }
    return sendJson(res, 401, { error: 'No autenticado' });
  }
  if (!auth) return sendJson(res, 401, { error: 'No autenticado' });

  try {
    const rows = await restSelect(
      'reservations',
      `select=*&user_id=eq.${encodeURIComponent(auth.user.id)}&order=created_at.desc&limit=20`
    );
    sendJson(res, 200, { data: rows });
  } catch (error) {
    console.error('reservations/me select error:', error);
    sendJson(res, 200, { data: [] });
  }
};
