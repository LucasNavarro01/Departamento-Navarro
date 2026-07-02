const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkRangeAvailability, nightsBetween } = require('../api/_lib/availability-check');

test('returns available when no nights overlap occupied dates', () => {
  const result = checkRangeAvailability('2026-08-10', '2026-08-13', ['2026-08-20']);
  assert.equal(result.available, true);
  assert.equal(result.nights, 3);
  assert.deepEqual(result.conflictDates, []);
});

test('returns unavailable when a night overlaps an occupied date', () => {
  const result = checkRangeAvailability('2026-08-10', '2026-08-13', ['2026-08-11']);
  assert.equal(result.available, false);
  assert.deepEqual(result.conflictDates, ['2026-08-11']);
});

test('checkout date itself is not considered an occupied night', () => {
  const result = checkRangeAvailability('2026-08-10', '2026-08-13', ['2026-08-13']);
  assert.equal(result.available, true);
});

test('throws when checkout is not after checkin', () => {
  assert.throws(() => checkRangeAvailability('2026-08-13', '2026-08-13', []));
  assert.throws(() => checkRangeAvailability('2026-08-14', '2026-08-13', []));
});

test('throws on malformed date keys', () => {
  assert.throws(() => checkRangeAvailability('10-08-2026', '2026-08-13', []));
  assert.throws(() => checkRangeAvailability('2026-08-10', 'not-a-date', []));
});

test('nightsBetween returns one key per night, excluding checkout', () => {
  assert.deepEqual(nightsBetween('2026-08-10', '2026-08-13'), [
    '2026-08-10',
    '2026-08-11',
    '2026-08-12'
  ]);
});
