const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rateLimit, getClientIp } = require('../api/_lib/rate-limit');

test('rateLimit allows requests under the limit', () => {
  const key = `test-${Math.random()}`;
  for (let i = 0; i < 3; i += 1) {
    const result = rateLimit(key, 3, 60_000);
    assert.equal(result.allowed, true);
  }
});

test('rateLimit blocks once the limit is exceeded within the window', () => {
  const key = `test-${Math.random()}`;
  rateLimit(key, 2, 60_000);
  rateLimit(key, 2, 60_000);
  const blocked = rateLimit(key, 2, 60_000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfter > 0);
});

test('rateLimit resets the count after the window elapses', () => {
  const key = `test-${Math.random()}`;
  rateLimit(key, 1, 1);
  return new Promise(resolve => {
    setTimeout(() => {
      const result = rateLimit(key, 1, 1);
      assert.equal(result.allowed, true);
      resolve();
    }, 20);
  });
});

test('rateLimit tracks separate keys independently', () => {
  const keyA = `a-${Math.random()}`;
  const keyB = `b-${Math.random()}`;
  rateLimit(keyA, 1, 60_000);
  const blockedA = rateLimit(keyA, 1, 60_000);
  const allowedB = rateLimit(keyB, 1, 60_000);
  assert.equal(blockedA.allowed, false);
  assert.equal(allowedB.allowed, true);
});

test('getClientIp prefers x-real-ip over x-forwarded-for', () => {
  const req = { headers: { 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9, 8.8.8.8' } };
  assert.equal(getClientIp(req), '1.2.3.4');
});

test('getClientIp falls back to the first x-forwarded-for value', () => {
  const req = { headers: { 'x-forwarded-for': '9.9.9.9, 8.8.8.8' } };
  assert.equal(getClientIp(req), '9.9.9.9');
});

test('getClientIp returns unknown when no IP headers are present', () => {
  const req = { headers: {} };
  assert.equal(getClientIp(req), 'unknown');
});
