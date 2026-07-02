const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkRangeAvailability, buildWhatsAppMessage, buildWhatsAppUrl } = require('../booking');

test('checkRangeAvailability mirrors server-side behaviour', () => {
  const result = checkRangeAvailability('2026-08-10', '2026-08-13', ['2026-08-11']);
  assert.equal(result.available, false);
  assert.deepEqual(result.conflictDates, ['2026-08-11']);
});

test('buildWhatsAppMessage includes dates, nights and guest count', () => {
  const message = buildWhatsAppMessage({ checkin: '2026-08-10', checkout: '2026-08-13', nights: 3, guests: 4 });
  assert.match(message, /10\/08\/2026/);
  assert.match(message, /13\/08\/2026/);
  assert.match(message, /3 noches/);
  assert.match(message, /Huéspedes: 4/);
});

test('buildWhatsAppMessage uses singular night wording for a single night', () => {
  const message = buildWhatsAppMessage({ checkin: '2026-08-10', checkout: '2026-08-11', nights: 1, guests: 2 });
  assert.match(message, /1 noche\b/);
});

test('buildWhatsAppUrl strips non-digit characters from the phone and encodes the message', () => {
  const url = buildWhatsAppUrl('+54 9 260 4123456', 'Hola mundo!');
  assert.equal(url, 'https://wa.me/5492604123456?text=Hola%20mundo!');
});
