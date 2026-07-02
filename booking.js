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

function buildWhatsAppMessage({ checkin, checkout, nights, guests }) {
  const stay = nights === 1 ? '1 noche' : `${nights} noches`;
  return `Hola! Quiero reservar el Departamento Navarro. Llegada: ${formatDateLabel(checkin)}, salida: ${formatDateLabel(checkout)} (${stay}). Huéspedes: ${guests}.`;
}

function buildWhatsAppUrl(phone, message) {
  const cleanPhone = String(phone || '').replace(/[^\d]/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

if (typeof window !== 'undefined') {
  window.Booking = { checkRangeAvailability, buildWhatsAppMessage, buildWhatsAppUrl, nightsBetween, isValidDateKey };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { checkRangeAvailability, buildWhatsAppMessage, buildWhatsAppUrl, nightsBetween, isValidDateKey };
}
