const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseOccupiedDates } = require('../api/_lib/ical');

function buildIcs(events) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    ...events,
    'END:VCALENDAR'
  ].join('\r\n');
}

test('parses a reservation event into one date key per occupied night', () => {
  const ics = buildIcs([
    'BEGIN:VEVENT',
    'UID:1@test',
    'DTSTART;VALUE=DATE:20260810',
    'DTEND;VALUE=DATE:20260813',
    'SUMMARY:Reserved',
    'END:VEVENT'
  ]);

  assert.deepEqual(parseOccupiedDates(ics), ['2026-08-10', '2026-08-11', '2026-08-12']);
});

test('ignores cancelled events', () => {
  const ics = buildIcs([
    'BEGIN:VEVENT',
    'UID:2@test',
    'DTSTART;VALUE=DATE:20260810',
    'DTEND;VALUE=DATE:20260812',
    'STATUS:CANCELLED',
    'SUMMARY:Cancelled',
    'END:VEVENT'
  ]);

  assert.deepEqual(parseOccupiedDates(ics), []);
});

test('returns an empty list for a calendar with no events', () => {
  assert.deepEqual(parseOccupiedDates(buildIcs([])), []);
});
