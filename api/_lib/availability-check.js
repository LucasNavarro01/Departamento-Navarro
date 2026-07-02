const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateKey(value) {
  if (!DATE_RE.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
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

module.exports = {
  isValidDateKey,
  nightsBetween,
  checkRangeAvailability
};
