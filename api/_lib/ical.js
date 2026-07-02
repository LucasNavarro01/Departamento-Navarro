const ical = require('node-ical');

function toDateKey(date) {
  return date.toISOString().split('T')[0];
}

function getEventDateKeys(event) {
  if (!event.start || !event.end) {
    return [];
  }

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

  const dateKeys = [];
  for (const cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dateKeys.push(toDateKey(cursor));
  }

  return dateKeys;
}

function parseOccupiedDates(icsText) {
  const calendar = ical.sync.parseICS(icsText);
  const occupiedDates = [];

  for (const event of Object.values(calendar)) {
    if (event.type !== 'VEVENT' || event.status === 'CANCELLED') {
      continue;
    }

    occupiedDates.push(...getEventDateKeys(event));
  }

  return occupiedDates;
}

async function fetchOccupiedDates(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`No se pudo leer el calendario (${response.status})`);
  }

  return parseOccupiedDates(await response.text());
}

async function fetchAllOccupiedDates(urls) {
  const results = await Promise.allSettled(urls.filter(Boolean).map(fetchOccupiedDates));
  const occupiedDates = results
    .filter(result => result.status === 'fulfilled')
    .flatMap(result => result.value);
  const failedCount = results.filter(result => result.status === 'rejected').length;

  return {
    occupiedDates: [...new Set(occupiedDates)].sort(),
    failedCount
  };
}

module.exports = {
  parseOccupiedDates,
  fetchOccupiedDates,
  fetchAllOccupiedDates
};
