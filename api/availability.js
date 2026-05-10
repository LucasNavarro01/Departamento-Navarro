const ical = require('node-ical');

const FIFTEEN_MINUTES = 900;

function toDateKey(date) {
  return date.toISOString().split('T')[0];
}

function getEventDates(event) {
  if (!event.start || !event.end) {
    return [];
  }

  const dates = [];
  const start = new Date(Date.UTC(
    event.start.getUTCFullYear(),
    event.start.getUTCMonth(),
    event.start.getUTCDate()
  ));
  const end = new Date(Date.UTC(
    event.end.getUTCFullYear(),
    event.end.getUTCMonth(),
    event.end.getUTCDate()
  ));

  for (const cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(toDateKey(cursor));
  }

  return dates;
}

async function fetchCalendarDates(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`No se pudo leer el calendario (${response.status})`);
  }

  const calendar = ical.sync.parseICS(await response.text());
  const blockedDates = [];

  for (const event of Object.values(calendar)) {
    if (event.type !== 'VEVENT' || event.status === 'CANCELLED') {
      continue;
    }

    blockedDates.push(...getEventDates(event));
  }

  return blockedDates;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    res.status(405).json({
      blockedDates: [],
      error: 'Method not allowed',
      updatedAt: new Date().toISOString()
    });
    return;
  }

  res.setHeader('Cache-Control', `public, max-age=${FIFTEEN_MINUTES}`);

  const calendarUrls = [
    process.env.BOOKING_ICAL_URL,
    process.env.AIRBNB_ICAL_URL
  ].filter(Boolean);

  if (calendarUrls.length === 0) {
    res.status(200).json({
      blockedDates: [],
      error: 'No hay calendarios iCal configurados',
      updatedAt: new Date().toISOString()
    });
    return;
  }

  try {
    const calendars = await Promise.all(calendarUrls.map(fetchCalendarDates));
    const blockedDates = [...new Set(calendars.flat())].sort();

    res.status(200).json({
      blockedDates,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(200).json({
      blockedDates: [],
      error: error.message || 'No se pudo cargar la disponibilidad',
      updatedAt: new Date().toISOString()
    });
  }
};
