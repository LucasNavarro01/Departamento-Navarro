const { readBody, sendJson } = require('./_lib/http');
const { requireSession } = require('./_lib/auth');
const { getCouponTier, getManualCouponPercent } = require('./_lib/coupons');
const { restInsert, restPatch, restSelect } = require('./_lib/supabase');

const NIGHTLY_RATE = 18500;
const CLEANING_FEE = 4500;

function daysBetween(checkin, checkout) {
  const start = new Date(`${checkin}T00:00:00Z`);
  const end = new Date(`${checkout}T00:00:00Z`);
  return Math.round((end - start) / 86400000);
}

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

  const nights = daysBetween(checkin, checkout);
  if (!Number.isFinite(nights) || nights < 1) {
    return sendJson(res, 400, { error: 'La salida debe ser posterior a la llegada' });
  }
  if (await hasOverlap(checkin, checkout)) {
    return sendJson(res, 409, { error: 'Las fechas seleccionadas no estan disponibles' });
  }

  const subtotal = NIGHTLY_RATE * nights;
  const autoPct = auth ? getCouponTier(auth.reservationCount).percent : 0;
  const manualPct = getManualCouponPercent(body.couponCode);
  const appliedPct = Math.max(autoPct, manualPct);
  const discountAmount = Math.round(subtotal * (appliedPct / 100));
  const total = subtotal - discountAmount + CLEANING_FEE;
  const currentTier = auth ? getCouponTier(auth.reservationCount) : null;
  const newTier = auth ? getCouponTier(auth.reservationCount + 1) : null;
  const leveledUp = Boolean(auth && currentTier.key !== newTier.key);

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
    subtotal,
    discount_pct: appliedPct,
    discount_amount: discountAmount,
    cleaning_fee: CLEANING_FEE,
    total,
    coupon_code: manualPct > 0 ? String(body.couponCode).trim().toUpperCase() : null
  }]);

  if (auth) {
    await restPatch(
      'loyalty_profiles',
      `id=eq.${encodeURIComponent(auth.user.id)}`,
      { reservation_count: auth.reservationCount + 1, updated_at: new Date().toISOString() }
    );
  }

  sendJson(res, 200, {
    data: {
      id: inserted[0]?.id,
      total,
      appliedPct,
      discountAmount,
      newTier,
      leveledUp,
      nights,
      guests
    }
  });
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

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
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
