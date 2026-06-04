const crypto = require('crypto');
const { parseCookies, setCookie } = require('./http');
const { getSupabaseUser, refreshSupabaseSession, restSelect, restUpsert } = require('./supabase');
const { getCouponTier } = require('./coupons');

const COOKIE_NAME = 'dn_session';

function secret() {
  return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || 'dev-session-secret';
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

function encodeSession(session) {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function decodeSession(value) {
  const [payload, signature] = String(value || '').split('.');
  if (!payload || !signature || sign(payload) !== signature) return null;
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

function setSessionCookie(res, session, remember = true) {
  setCookie(res, COOKIE_NAME, encodeSession(session), { maxAge: remember ? 60 * 60 * 24 * 90 : 60 * 60 * 24 * 7 });
}

async function upsertProfile(user) {
  const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Huesped';
  const rows = await restUpsert('loyalty_profiles', [{
    id: user.id,
    email: user.email,
    name,
    updated_at: new Date().toISOString()
  }], 'id');
  return rows[0];
}

async function getProfile(userId) {
  const rows = await restSelect('loyalty_profiles', `select=*&id=eq.${encodeURIComponent(userId)}&limit=1`);
  return rows[0] || null;
}

async function countCompletedDirectStays(userId) {
  const rows = await restSelect(
    'reservations',
    [
      'select=id',
      `user_id=eq.${encodeURIComponent(userId)}`,
      'source=eq.direct',
      'status=eq.completed'
    ].join('&')
  );
  return rows.length;
}

async function requireSession(req, res) {
  const raw = parseCookies(req)[COOKIE_NAME];
  let session = decodeSession(raw);
  if (!session?.access_token) return null;

  try {
    const expiresAt = Number(session.expires_at || 0);
    if (session.refresh_token && expiresAt && expiresAt - 60 < Math.floor(Date.now() / 1000)) {
      const refreshed = await refreshSupabaseSession(session.refresh_token);
      session = {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token || session.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + Number(refreshed.expires_in || 3600)
      };
      setSessionCookie(res, session, true);
    }

    const authUser = await getSupabaseUser(session.access_token);
    const profile = await upsertProfile(authUser);
    const count = await countCompletedDirectStays(authUser.id);
    if (Number(profile?.reservation_count || 0) !== count) {
      await restUpsert('loyalty_profiles', [{
        id: authUser.id,
        email: authUser.email,
        name: profile?.name || authUser.user_metadata?.full_name || authUser.email,
        reservation_count: count,
        updated_at: new Date().toISOString()
      }], 'id');
    }
    return {
      session,
      user: {
        id: authUser.id,
        email: authUser.email,
        name: profile?.name || authUser.user_metadata?.full_name || authUser.email
      },
      profile,
      reservationCount: count,
      tier: getCouponTier(count)
    };
  } catch (error) {
    return null;
  }
}

module.exports = { COOKIE_NAME, setSessionCookie, requireSession, getProfile, upsertProfile, countCompletedDirectStays };
