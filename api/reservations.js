const { readBody, sendJson } = require('./_lib/http');
const { requireSession } = require('./_lib/auth');
const { getCouponTier, getManualCouponPercent } = require('./_lib/coupons');
const { restInsert, restPatch, restSelect } = require('./_lib/supabase');

const CLEANING_FEE = 4500;
const DEFAULT_PRICE_BY_GUESTS = {
  1: 25000,
  2: 30000,
  3: 40000,
  4: 50000,
  5: 60000,
  6: 70000
};

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

async function hasManualBlock(checkin, checkout) {
  const rows = await restSelect(
    'blocked_dates',
    [
      'select=id',
      `start_date=lt.${encodeURIComponent(checkout)}`,
      `end_date=gt.${encodeURIComponent(checkin)}`,
      'limit=1'
    ].join('&')
  );
  return rows.length > 0;
}

async function readConfig() {
  const rows = await restSelect('property_config', 'select=key,value');
  return rows.reduce((config, row) => {
    config[row.key] = row.value;
    return config;
  }, {});
}

async function readCalendarRules(checkin, checkout) {
  return restSelect(
    'calendar_rules',
    [
      'select=start_date,end_date,price_per_night,min_nights',
      `start_date=lt.${encodeURIComponent(checkout)}`,
      `end_date=gt.${encodeURIComponent(checkin)}`,
      'order=start_date.asc'
    ].join('&')
  );
}

function dateKeysBetween(checkin, checkout) {
  const dates = [];
  const start = new Date(`${checkin}T00:00:00Z`);
  const end = new Date(`${checkout}T00:00:00Z`);
  for (const cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
}

function getBaseNightlyRate(config, guests) {
  const guestPrices = config.price_by_guests && typeof config.price_by_guests === 'object'
    ? config.price_by_guests
    : DEFAULT_PRICE_BY_GUESTS;
  return Number(guestPrices[String(guests)] || guestPrices[guests] || guestPrices[6] || 0);
}

function getRuleForDate(rules, dateKey) {
  return rules.find(rule => rule.start_date <= dateKey && rule.end_date > dateKey);
}

function calculateStay({ checkin, checkout, guests, config, rules }) {
  const nights = dateKeysBetween(checkin, checkout);
  const baseRate = getBaseNightlyRate(config, guests);
  const minNights = Math.max(
    1,
    Number(config.min_nights_low || 1),
    ...rules.map(rule => Number(rule.min_nights || 1))
  );
  const nightlyRates = nights.map(dateKey => {
    const rule = getRuleForDate(rules, dateKey);
    return Number(rule?.price_per_night || baseRate);
  });

  return {
    minNights,
    nightlyRates,
    subtotal: nightlyRates.reduce((sum, rate) => sum + rate, 0)
  };
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
  if (await hasManualBlock(checkin, checkout)) {
    return sendJson(res, 409, { error: 'Las fechas seleccionadas estan cerradas' });
  }

  const [config, rules] = await Promise.all([
    readConfig(),
    readCalendarRules(checkin, checkout)
  ]);
  const pricing = calculateStay({ checkin, checkout, guests, config, rules });
  if (nights < pricing.minNights) {
    return sendJson(res, 400, { error: `La estadia minima para esas fechas es de ${pricing.minNights} ${pricing.minNights === 1 ? 'noche' : 'noches'}` });
  }

  const subtotal = pricing.subtotal;
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
