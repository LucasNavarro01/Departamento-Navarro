const { fetchAllOccupiedDates } = require('./_lib/ical');

const FIFTEEN_MINUTES = 900;

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

  const icalUrls = [process.env.BOOKING_ICAL_URL, process.env.AIRBNB_ICAL_URL].filter(Boolean);

  if (icalUrls.length === 0) {
    res.status(200).json({
      blockedDates: [],
      error: 'No hay calendarios iCal configurados (BOOKING_ICAL_URL / AIRBNB_ICAL_URL)',
      updatedAt: new Date().toISOString()
    });
    return;
  }

  try {
    const { occupiedDates, failedCount } = await fetchAllOccupiedDates(icalUrls);

    res.status(200).json({
      blockedDates: occupiedDates,
      ...(failedCount > 0 ? { error: 'Algunas fuentes de disponibilidad no pudieron cargarse' } : {}),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('availability error:', error);
    res.status(200).json({
      blockedDates: [],
      error: 'No se pudo cargar la disponibilidad',
      updatedAt: new Date().toISOString()
    });
  }
};
