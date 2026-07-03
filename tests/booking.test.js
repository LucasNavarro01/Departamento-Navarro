const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  checkRangeAvailability,
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  dateKeyFromParts,
  buildCalendarWeeks,
  selectCalendarDay
} = require('../booking');

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

test('dateKeyFromParts builds a date key from day/month/year strings', () => {
  assert.equal(dateKeyFromParts('12', '07', '2026'), '2026-07-12');
  assert.equal(dateKeyFromParts(5, 9, 2026), '2026-09-05');
});

test('dateKeyFromParts rejects impossible calendar dates', () => {
  assert.equal(dateKeyFromParts('30', '02', '2026'), null);
  assert.equal(dateKeyFromParts('31', '04', '2026'), null);
});

test('dateKeyFromParts rejects incomplete or out-of-range input', () => {
  assert.equal(dateKeyFromParts('', '07', '2026'), null);
  assert.equal(dateKeyFromParts('12', '13', '2026'), null);
  assert.equal(dateKeyFromParts('12', '07', '26'), null);
});

test('buildCalendarWeeks pads the first and last week with blank cells', () => {
  const weeks = buildCalendarWeeks({ year: 2026, month: 6, checkin: null, checkout: null, todayKey: '2026-07-01' }); // July 2026
  assert.ok(weeks.length >= 4);
  weeks.forEach(week => assert.equal(week.length, 7));
  assert.equal(weeks[0][0].state, 'blank'); // July 1, 2026 is a Wednesday
});

test('buildCalendarWeeks marks past days as disabled', () => {
  const weeks = buildCalendarWeeks({ year: 2026, month: 6, checkin: null, checkout: null, todayKey: '2026-07-15' });
  const flat = weeks.flat().filter(cell => cell.dateKey);
  const july10 = flat.find(cell => cell.dateKey === '2026-07-10');
  const july20 = flat.find(cell => cell.dateKey === '2026-07-20');
  assert.equal(july10.state, 'past');
  assert.equal(july10.disabled, true);
  assert.equal(july20.state, 'normal');
  assert.equal(july20.disabled, false);
});

test('buildCalendarWeeks marks checkin/checkout and the nights between them', () => {
  const weeks = buildCalendarWeeks({
    year: 2026, month: 6, checkin: '2026-07-10', checkout: '2026-07-13', todayKey: '2026-07-01'
  });
  const flat = weeks.flat().filter(cell => cell.dateKey);
  assert.equal(flat.find(cell => cell.dateKey === '2026-07-10').state, 'selected');
  assert.equal(flat.find(cell => cell.dateKey === '2026-07-13').state, 'selected');
  assert.equal(flat.find(cell => cell.dateKey === '2026-07-11').state, 'inRange');
  assert.equal(flat.find(cell => cell.dateKey === '2026-07-09').state, 'normal');
});

test('selectCalendarDay picks checkin first, then checkout', () => {
  let range = selectCalendarDay({ checkin: null, checkout: null }, '2026-07-10');
  assert.deepEqual(range, { checkin: '2026-07-10', checkout: null });

  range = selectCalendarDay(range, '2026-07-13');
  assert.deepEqual(range, { checkin: '2026-07-10', checkout: '2026-07-13' });
});

test('selectCalendarDay restarts the range when picking a date before checkin', () => {
  const range = selectCalendarDay({ checkin: '2026-07-10', checkout: null }, '2026-07-05');
  assert.deepEqual(range, { checkin: '2026-07-05', checkout: null });
});

test('selectCalendarDay starts a new range when both dates are already set', () => {
  const range = selectCalendarDay({ checkin: '2026-07-10', checkout: '2026-07-13' }, '2026-07-20');
  assert.deepEqual(range, { checkin: '2026-07-20', checkout: null });
});
