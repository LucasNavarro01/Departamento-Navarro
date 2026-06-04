const { restSelect } = require('./_lib/supabase');

const FIFTEEN_MINUTES = 900;
const DOMAIN = 'departamento-navarro';

function compactDate(dateKey) {
  return String(dateKey || '').replace(/-/g, '');
}

function escapeIcsText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function nowStamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function buildEvent({ uid, start, end, summary, stamp }) {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@${DOMAIN}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compactDate(start)}`,
    `DTEND;VALUE=DATE:${compactDate(end)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    'END:VEVENT'
  ];
}

function buildCalendar(events) {
  const stamp = nowStamp();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Departamento Navarro//Reservas//ES',
    'CALSCALE:GREGORIAN',
    ...events.flatMap(event => buildEvent({ ...event, stamp })),
    'END:VCALENDAR'
  ];

  return `${lines.join('\r\n')}\r\n`;
}

async function getReservationEvents() {
  const rows = await restSelect(
    'reservations',
    [
      'select=id,checkin,checkout,status',
      'status=in.(confirmed,pending)',
      'order=checkin.asc'
    ].join('&')
  );

  return rows
    .filter(row => row.checkin && row.checkout && row.checkin < row.checkout)
    .map(row => ({
      uid: `reserva-${row.id}`,
      start: row.checkin,
      end: row.checkout,
      summary: row.status === 'pending' ? 'Reserva pendiente' : 'Reservado'
    }));
}

async function getManualBlockEvents() {
  const rows = await restSelect(
    'blocked_dates',
    'select=id,start_date,end_date,reason&order=start_date.asc'
  );

  return rows
    .filter(row => row.start_date && row.end_date && row.start_date < row.end_date)
    .map(row => ({
      uid: `bloqueo-${row.id}`,
      start: row.start_date,
      end: row.end_date,
      summary: row.reason ? `No disponible - ${row.reason}` : 'No disponible'
    }));
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).send('Method not allowed');
  }

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Cache-Control', `public, max-age=${FIFTEEN_MINUTES}`);

  try {
    const [reservations, manualBlocks] = await Promise.all([
      getReservationEvents(),
      getManualBlockEvents()
    ]);
    return res.status(200).send(buildCalendar([...reservations, ...manualBlocks]));
  } catch (error) {
    return res.status(200).send(buildCalendar([]));
  }
};
