const { readBody, sendJson } = require('../_lib/http');
const { getSupabaseUser } = require('../_lib/supabase');
const { setSessionCookie, upsertProfile } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = await readBody(req);
    if (!body.access_token) return sendJson(res, 400, { error: 'Falta access_token' });

    const user = await getSupabaseUser(body.access_token);
    const profile = await upsertProfile(user);
    setSessionCookie(res, {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + Number(body.expires_in || 3600)
    }, body.remember !== false);

    sendJson(res, 200, {
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: profile?.name || user.user_metadata?.full_name || user.email
        }
      }
    });
  } catch (error) {
    sendJson(res, 401, { error: error.message || 'No se pudo iniciar sesion' });
  }
};
