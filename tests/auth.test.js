const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SessionConfigError, encodeSession, decodeSession } = require('../api/_lib/auth');

function withSessionSecret(sessionSecret, adminPassword, fn) {
  const originalSession = process.env.SESSION_SECRET;
  const originalAdmin = process.env.ADMIN_PASSWORD;
  if (sessionSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = sessionSecret;
  if (adminPassword === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = adminPassword;

  try {
    return fn();
  } finally {
    if (originalSession === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSession;
    if (originalAdmin === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalAdmin;
  }
}

test('encodeSession/decodeSession round-trip when a secret is configured', () => {
  withSessionSecret('a-test-secret', undefined, () => {
    const encoded = encodeSession({ access_token: 'abc' });
    assert.deepEqual(decodeSession(encoded), { access_token: 'abc' });
  });
});

test('decodeSession rejects a tampered signature', () => {
  withSessionSecret('a-test-secret', undefined, () => {
    const encoded = encodeSession({ access_token: 'abc' });
    const [payload] = encoded.split('.');
    assert.equal(decodeSession(`${payload}.not-the-real-signature`), null);
  });
});

test('decodeSession returns null (not a throw) for a malformed/corrupt cookie', () => {
  withSessionSecret('a-test-secret', undefined, () => {
    assert.equal(decodeSession('not-a-valid-cookie-at-all'), null);
    assert.equal(decodeSession(''), null);
    assert.equal(decodeSession(undefined), null);
  });
});

test('decodeSession returns null when the payload is valid base64 but not JSON', () => {
  withSessionSecret('a-test-secret', undefined, () => {
    const crypto = require('crypto');
    const payload = Buffer.from('not json{{{').toString('base64url');
    const signature = crypto.createHmac('sha256', 'a-test-secret').update(payload).digest('base64url');
    assert.equal(decodeSession(`${payload}.${signature}`), null);
  });
});

test('encodeSession throws SessionConfigError when neither SESSION_SECRET nor ADMIN_PASSWORD is set', () => {
  withSessionSecret(undefined, undefined, () => {
    assert.throws(() => encodeSession({ access_token: 'abc' }), SessionConfigError);
  });
});

test('decodeSession propagates SessionConfigError for a present-but-unverifiable cookie when unconfigured', () => {
  const encoded = withSessionSecret('a-test-secret', undefined, () => encodeSession({ access_token: 'abc' }));
  withSessionSecret(undefined, undefined, () => {
    assert.throws(() => decodeSession(encoded), SessionConfigError);
  });
});

test('ADMIN_PASSWORD is an accepted fallback secret when SESSION_SECRET is absent', () => {
  withSessionSecret(undefined, 'admin-fallback', () => {
    const encoded = encodeSession({ access_token: 'abc' });
    assert.deepEqual(decodeSession(encoded), { access_token: 'abc' });
  });
});
