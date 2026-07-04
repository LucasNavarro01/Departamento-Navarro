const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  checkAdminAuth,
  isValidAdminPassword,
  getAdminPasswordFromRequest,
  timingSafeEqualStrings
} = require('../api/_lib/admin-auth');

function withAdminPassword(value, fn) {
  const original = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = value;
  try {
    return fn();
  } finally {
    if (original === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = original;
  }
}

test('timingSafeEqualStrings matches equal strings regardless of length', () => {
  assert.equal(timingSafeEqualStrings('secret', 'secret'), true);
  assert.equal(timingSafeEqualStrings('short', 'a-much-longer-candidate-string'), false);
});

test('getAdminPasswordFromRequest prefers the x-admin-password header over the body', () => {
  const req = { headers: { 'x-admin-password': 'from-header' } };
  assert.equal(getAdminPasswordFromRequest(req, { password: 'from-body' }), 'from-header');
});

test('getAdminPasswordFromRequest falls back to the body when no header is present', () => {
  const req = { headers: {} };
  assert.equal(getAdminPasswordFromRequest(req, { password: 'from-body' }), 'from-body');
});

test('isValidAdminPassword rejects when ADMIN_PASSWORD is not configured', () => {
  withAdminPassword(undefined, () => {
    assert.equal(isValidAdminPassword('anything'), false);
  });
});

test('isValidAdminPassword accepts only an exact match', () => {
  withAdminPassword('correct-horse', () => {
    assert.equal(isValidAdminPassword('correct-horse'), true);
    assert.equal(isValidAdminPassword('wrong'), false);
    assert.equal(isValidAdminPassword(''), false);
  });
});

test('checkAdminAuth returns ok for a valid header-based password', () => {
  withAdminPassword('correct-horse', () => {
    const req = { headers: { 'x-admin-password': 'correct-horse' } };
    const result = checkAdminAuth(req, null);
    assert.equal(result.ok, true);
  });
});

test('checkAdminAuth returns 401 for a wrong password without leaking details', () => {
  withAdminPassword('correct-horse', () => {
    const req = { headers: { 'x-admin-password': 'nope' } };
    const result = checkAdminAuth(req, null);
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
    assert.equal(result.message, 'Unauthorized');
  });
});

test('checkAdminAuth returns 429 with retryAfter once the attempt limit is exceeded', () => {
  withAdminPassword('correct-horse', () => {
    const req = { headers: { 'x-admin-password': 'nope', 'x-real-ip': `1.1.1.${Math.random()}` } };
    for (let i = 0; i < 8; i += 1) checkAdminAuth(req, null);
    const blocked = checkAdminAuth(req, null);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.status, 429);
    assert.ok(blocked.retryAfter > 0);
  });
});
