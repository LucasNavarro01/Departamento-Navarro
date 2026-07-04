const { readBody, sendJson } = require('./_lib/http');
const { requireSession, SessionConfigError } = require('./_lib/auth');
const { checkAdminAuth } = require('./_lib/admin-auth');
const { rateLimit, getClientIp } = require('./_lib/rate-limit');
const { getManualCouponPercent } = require('./_lib/coupons');
const { buildQuote, assertValidStayRange } = require('./_lib/pricing');
const { restInsert, restPatch, restSelect } = require('./_lib/supabase');

const CREATE_RATE_LIMIT_MAX = 3;
const CREATE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

async function hasOverlap(checkin, checkout) {
  const query = [
    'select=id',
    'status=neq.cancelled',
    `checkin=lt.${encodeURIComponent(checkout)}`,
    `checkout=gt.${encodeURIComponent(checkin)}`,
    'limit=1'
  ].join('&');
  const rows = await restSelect('reservations', query);
  return rows.length > 0;
}

function enforceAdminAuth(req, res, body) {
  const auth = checkAdminAuth(req, body);
  if (!auth.ok) {
    if (auth.retryAfter) res.setHeader('Retry-After', String(auth.retryAfter));
    sendJson(res, auth.status, { error: auth.message });
    return false;
  }
  return true;
}

async function createReservation(req, res) {
  const limit = rateLimit(`reservations-create:${getClientIp(req)}`, CREATE_RATE_LIMIT_MAX, CREATE_RATE_LIMIT_WINDOW_MS);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return sendJson(res, 429, { error: 'Demasiados intentos. Intenta mas tarde.' });
  }

  const body = await readBody(req);
  const guests = Number(body.guests || body.num_guests || 1);

  if (body._honeypot) {
    // Bot filled a field that's hidden from real visitors — fake a normal
    // success so it doesn't learn anything, but never touch the database.
    return sendJson(res, 200, { data: { id: null, total: 0, appliedPct: 0, discountAmount: 0, nights: 0, guests } });
  }

  const auth = await requireSession(req, res);
  const checkin = body.checkin;
  const checkout = body.checkout;
  const pets = Boolean(body.pets);
  const contact = body.contact || {};
  const guestName = contact.name || body.guest_name || auth?.user?.name;
  const guestEmail = contact.email || body.guest_email || auth?.user?.email;
  const guestPhone = contact.phone || body.guest_phone || '';

  if (!checkin || !checkout || !guestName) {
    return sendJson(res, 400, { error: 'Faltan datos obligatorios' });
  }
  if (!Number.isInteger(guests) || guests < 1 || guests > 6) {
    return sendJson(res, 400, { error: 'La cantidad de huespedes debe estar entre 1 y 6' });
  }

  let nights;
  try {
    nights = assertValidStayRange(checkin, checkout);
  } catch (error) {
    return sendJson(res, 400, { error: error.message });
  }

  if (await hasOverlap(checkin, checkout)) {
    return sendJson(res, 409, { error: 'Las fechas seleccionadas no estan disponibles' });
  }
  const manualPct = getManualCouponPercent(body.couponCode);
  const discountPct = Math.max(auth?.tier?.percent || 0, manualPct);
  const quote = await buildQuote({ checkin, checkout, guests, discountPct });
  if (quote.blocked) {
    return sendJson(res, 409, { error: 'Las fechas seleccionadas estan cerradas' });
  }
  if (!quote.meetsMinNights) {
    return sendJson(res, 400, { error: `La estadia minima para esas fechas es de ${quote.minNights} ${quote.minNights === 1 ? 'noche' : 'noches'}` });
  }

  // Public reservations start as pending, not confirmed — an unattended bot
  // POST can't lock in dates on its own; an admin has to confirm it first.
  // hasOverlap() above already excludes only 'cancelled', so pending rows
  // still block the calendar for everyone else in the meantime.
  const inserted = await restInsert('reservations', [{
    user_id: auth?.user?.id || null,
    checkin,
    checkout,
    guest_name: guestName,
    guest_email: guestEmail,
    guest_phone: guestPhone,
    num_guests: guests,
    guests,
    pets,
    message: body.message || null,
    source: 'direct',
    status: 'pending',
    subtotal: quote.subtotal,
    discount_pct: quote.discountPct,
    discount_amount: quote.discountAmount,
    cleaning_fee: quote.cleaningFee,
    total: quote.total,
    coupon_code: manualPct > 0 ? String(body.couponCode).trim().toUpperCase() : null
  }]);

  sendJson(res, 200, {
    data: {
      id: inserted[0]?.id,
      total: quote.total,
      appliedPct: quote.discountPct,
      discountAmount: quote.discountAmount,
      nights,
      guests
    }
  });
}

async function updateReservationStatus(req, res) {
  const body = await readBody(req);
  if (!enforceAdminAuth(req, res, body)) return;

  const allowedStatuses = new Set(['pending', 'confirmed', 'completed', 'cancelled']);
  if (!body.id || !allowedStatuses.has(body.status)) {
    return sendJson(res, 400, { error: 'Reserva o estado invalido' });
  }

  const currentRows = await restSelect('reservations', `select=*&id=eq.${encodeURIComponent(body.id)}&limit=1`);
  const current = currentRows[0];
  if (!current) return sendJson(res, 404, { error: 'Reserva no encontrada' });

  const validTransitions = {
    pending: new Set(['confirmed', 'cancelled']),
    confirmed: new Set(['completed', 'cancelled']),
    completed: new Set(['cancelled']),
    cancelled: new Set(['pending', 'confirmed'])
  };
  if (!validTransitions[current.status || 'pending']?.has(body.status)) {
    return sendJson(res, 400, { error: 'Transicion de estado no permitida' });
  }

  const rows = await restPatch(
    'reservations',
    `id=eq.${encodeURIComponent(body.id)}`,
    { status: body.status }
  );

  if (current.user_id) {
    const completedRows = await restSelect(
      'reservations',
      [
        'select=id',
        `user_id=eq.${encodeURIComponent(current.user_id)}`,
        'source=eq.direct',
        'status=eq.completed'
      ].join('&')
    );
    await restPatch(
      'loyalty_profiles',
      `id=eq.${encodeURIComponent(current.user_id)}`,
      { reservation_count: completedRows.length, updated_at: new Date().toISOString() }
    );
  }

  return sendJson(res, 200, { data: rows[0] || null });
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method === 'POST') {
    try {
      return await createReservation(req, res);
    } catch (error) {
      console.error('reservations POST error:', error);
      if (error instanceof SessionConfigError) {
        return sendJson(res, 503, { error: 'Sesion no configurada. Contacta al administrador.' });
      }
      return sendJson(res, 500, { error: 'No se pudo crear la reserva' });
    }
  }
  if (req.method === 'PATCH') {
    try {
      return await updateReservationStatus(req, res);
    } catch (error) {
      console.error('reservations PATCH error:', error);
      return sendJson(res, 500, { error: 'No se pudo actualizar la reserva' });
    }
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST, PATCH, OPTIONS');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  if (!enforceAdminAuth(req, res, null)) return;

  try {
    const rows = await restSelect('reservations', 'select=*&order=checkin.asc&limit=100');
    return sendJson(res, 200, { data: rows });
  } catch (error) {
    console.error('reservations GET error:', error);
    return sendJson(res, 500, { error: 'No se pudieron leer las reservas' });
  }
};
