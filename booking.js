function isValidDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function nightsBetween(checkin, checkout) {
  const dateKeys = [];
  const start = new Date(`${checkin}T00:00:00Z`);
  const end = new Date(`${checkout}T00:00:00Z`);

  for (const cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dateKeys.push(cursor.toISOString().slice(0, 10));
  }

  return dateKeys;
}

function checkRangeAvailability(checkin, checkout, occupiedDates) {
  if (!isValidDateKey(checkin) || !isValidDateKey(checkout)) {
    throw new Error('Las fechas deben tener formato YYYY-MM-DD');
  }

  if (checkin >= checkout) {
    throw new Error('La fecha de salida debe ser posterior a la de llegada');
  }

  const occupied = new Set(occupiedDates || []);
  const nights = nightsBetween(checkin, checkout);
  const conflictDates = nights.filter(night => occupied.has(night));

  return {
    available: conflictDates.length === 0,
    nights: nights.length,
    conflictDates
  };
}

function formatDateLabel(dateKey) {
  const [year, month, day] = String(dateKey).split('-');
  return `${day}/${month}/${year}`;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function dateKeyFromParts(day, month, year) {
  day = Number(day);
  month = Number(month);
  year = Number(year);
  if (!day || !month || !year || String(year).length < 4) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;

  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function todayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function buildCalendarWeeks({ year, month, checkin, checkout, todayKey, blockedDates }) {
  todayKey = todayKey || todayDateKey();
  const blocked = blockedDates instanceof Set ? blockedDates : new Set(blockedDates || []);
  const startDow = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const blankCell = () => ({ day: null, dateKey: null, state: 'blank', disabled: true });
  const cells = [];
  for (let i = 0; i < startDow; i += 1) cells.push(blankCell());

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${year}-${pad2(month + 1)}-${pad2(day)}`;
    const isPast = dateKey < todayKey;
    const isBlocked = blocked.has(dateKey);
    const isCheckin = dateKey === checkin;
    const isCheckout = dateKey === checkout;
    const inRange = Boolean(checkin && checkout && dateKey > checkin && dateKey < checkout);

    let state = 'normal';
    if (isPast) state = 'past';
    else if (isBlocked) state = 'blocked';
    else if (isCheckin || isCheckout) state = 'selected';
    else if (inRange) state = 'inRange';

    cells.push({ day, dateKey, state, disabled: isPast || isBlocked });
  }

  while (cells.length % 7 !== 0) cells.push(blankCell());

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function selectCalendarDay({ checkin, checkout }, dateKey) {
  if (!checkin || (checkin && checkout)) {
    return { checkin: dateKey, checkout: null };
  }
  if (dateKey <= checkin) {
    return { checkin: dateKey, checkout: null };
  }
  return { checkin, checkout: dateKey };
}

function buildWhatsAppMessage({ checkin, checkout, nights, guests }) {
  const stay = nights === 1 ? '1 noche' : `${nights} noches`;
  return `Hola! Quiero reservar el Departamento Navarro. Llegada: ${formatDateLabel(checkin)}, salida: ${formatDateLabel(checkout)} (${stay}). Huéspedes: ${guests}.`;
}

function buildWhatsAppUrl(phone, message) {
  const cleanPhone = String(phone || '').replace(/[^\d]/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

const BOOKING_API = {
  checkRangeAvailability,
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  nightsBetween,
  isValidDateKey,
  dateKeyFromParts,
  todayDateKey,
  buildCalendarWeeks,
  selectCalendarDay
};

if (typeof window !== 'undefined') {
  window.Booking = BOOKING_API;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BOOKING_API;
}
