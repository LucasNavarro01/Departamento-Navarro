const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ValidationError } = require('../api/_lib/http');
const { assertValidStayRange, MAX_NIGHTS, isDateKey } = require('../api/_lib/pricing');

test('assertValidStayRange returns the night count for a valid range', () => {
  assert.equal(assertValidStayRange('2026-08-10', '2026-08-13'), 3);
});

test('assertValidStayRange rejects malformed date strings', () => {
  assert.throws(() => assertValidStayRange('10-08-2026', '2026-08-13'), ValidationError);
  assert.throws(() => assertValidStayRange('2026-08-10', 'not-a-date'), ValidationError);
});

test('assertValidStayRange rejects an impossible calendar date', () => {
  assert.throws(() => assertValidStayRange('2026-02-30', '2026-03-01'), ValidationError);
});

test('assertValidStayRange rejects checkout on or before checkin', () => {
  assert.throws(() => assertValidStayRange('2026-08-13', '2026-08-13'), ValidationError);
  assert.throws(() => assertValidStayRange('2026-08-14', '2026-08-13'), ValidationError);
});

test('assertValidStayRange rejects a stay longer than MAX_NIGHTS', () => {
  assert.throws(() => assertValidStayRange('2026-01-01', '2026-12-31'), ValidationError);
});

test('assertValidStayRange accepts a stay exactly at MAX_NIGHTS', () => {
  const checkin = '2026-01-01';
  const checkoutDate = new Date(`${checkin}T00:00:00Z`);
  checkoutDate.setUTCDate(checkoutDate.getUTCDate() + MAX_NIGHTS);
  const checkout = checkoutDate.toISOString().slice(0, 10);
  assert.equal(assertValidStayRange(checkin, checkout), MAX_NIGHTS);
});

test('isDateKey rejects values that are not real calendar dates', () => {
  assert.equal(isDateKey('2026-13-01'), false);
  assert.equal(isDateKey('2026-02-30'), false);
  assert.equal(isDateKey('2026-08-10'), true);
});
