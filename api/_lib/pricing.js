const { restSelect } = require('./supabase');

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

function isDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
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
  ).catch(() => []);
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

function calculateStay({ checkin, checkout, guests, config, rules, discountPct = 0 }) {
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
  const subtotal = nightlyRates.reduce((sum, rate) => sum + rate, 0);
  const discountAmount = Math.round(subtotal * (Number(discountPct || 0) / 100));

  return {
    nights: nights.length,
    nightlyRates,
    subtotal,
    minNights,
    meetsMinNights: nights.length >= minNights,
    discountPct: Number(discountPct || 0),
    discountAmount,
    cleaningFee: CLEANING_FEE,
    total: subtotal - discountAmount + CLEANING_FEE
  };
}

async function buildQuote({ checkin, checkout, guests, discountPct = 0 }) {
  if (!isDateKey(checkin) || !isDateKey(checkout)) {
    throw new Error('Las fechas deben tener formato YYYY-MM-DD');
  }

  const guestCount = Number(guests || 1);
  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 6) {
    throw new Error('La cantidad de huespedes debe estar entre 1 y 6');
  }

  const nights = daysBetween(checkin, checkout);
  if (!Number.isFinite(nights) || nights < 1) {
    throw new Error('La salida debe ser posterior a la llegada');
  }

  const [config, rules, manuallyBlocked] = await Promise.all([
    readConfig(),
    readCalendarRules(checkin, checkout),
    hasManualBlock(checkin, checkout)
  ]);
  const quote = calculateStay({ checkin, checkout, guests: guestCount, config, rules, discountPct });

  return {
    ...quote,
    guests: guestCount,
    blocked: manuallyBlocked
  };
}

module.exports = {
  CLEANING_FEE,
  DEFAULT_PRICE_BY_GUESTS,
  daysBetween,
  calculateStay,
  buildQuote,
  hasManualBlock
};
