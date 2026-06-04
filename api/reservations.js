const { readBody, sendJson } = require('./_lib/http');
const { requireSession } = require('./_lib/auth');
const { getManualCouponPercent } = require('./_lib/coupons');
const { buildQuote, daysBetween } = require('./_lib/pricing');
const { restInsert, restPatch, restSelect } = require('./_lib/supabase');

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

async function createReservation(req, res) {
  const auth = await requireSession(req, res);
  const body = await readBody(req);
  const checkin = body.checkin;
  const checkout = body.checkout;
  const guests = Number(body.guests || body.num_guests || 1);
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

  const nights = daysBetween(checkin, checkout);
  if (!Number.isFinite(nights) || nights < 1) {
    return sendJson(res, 400, { error: 'La salida debe ser posterior a la llegada' });
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
    status: 'confirmed',
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
  const allowedStatuses = new Set(['pending', 'confirmed', 'completed', 'cancelled']);

  if (!process.env.ADMIN_PASSWORD || body.password !== process.env.ADMIN_PASSWORD) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

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
      return sendJson(res, 500, { error: error.message || 'No se pudo crear la reserva' });
    }
  }
  if (req.method === 'PATCH') {
    try {
      return await updateReservationStatus(req, res);
    } catch (error) {
      return sendJson(res, 500, { error: error.message || 'No se pudo actualizar la reserva' });
    }
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST, PATCH, OPTIONS');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  if (!process.env.ADMIN_PASSWORD || req.query.password !== process.env.ADMIN_PASSWORD) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  try {
    const rows = await restSelect('reservations', 'select=*&order=checkin.asc&limit=100');
    return sendJson(res, 200, { data: rows });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'No se pudieron leer las reservas' });
  }
};
