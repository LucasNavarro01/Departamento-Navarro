const { test } = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/reservations');

function fakeRes() {
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    end() { return this; }
  };
  return res;
}

function fakeReq({ method, headers = {}, body = {}, query = {} }) {
  return { method, headers, body, query };
}

test('POST with _honeypot filled returns a simulated success without needing Supabase configured', async () => {
  const req = fakeReq({
    method: 'POST',
    headers: { 'x-real-ip': `honeypot-${Math.random()}` },
    body: { _honeypot: 'a bot filled this', checkin: '2026-08-10', checkout: '2026-08-13', guests: 2 }
  });
  const res = fakeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.id, null);
  assert.equal(res.body.error, null);
});

test('GET without x-admin-password is rejected with 401', async () => {
  const req = fakeReq({ method: 'GET', headers: { 'x-real-ip': `admin-${Math.random()}` } });
  const res = fakeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 401);
});

test('GET with the wrong password 8 times in a row is rate-limited on the 9th attempt', async () => {
  const ip = `admin-brute-${Math.random()}`;
  let last;
  for (let i = 0; i < 9; i += 1) {
    const req = fakeReq({ method: 'GET', headers: { 'x-real-ip': ip, 'x-admin-password': 'wrong' } });
    const res = fakeRes();
    await handler(req, res);
    last = res;
  }

  assert.equal(last.statusCode, 429);
  assert.ok(last.headers['Retry-After']);
});

test('PATCH without x-admin-password is rejected with 401 before touching the reservation', async () => {
  const req = fakeReq({
    method: 'PATCH',
    headers: { 'x-real-ip': `patch-${Math.random()}` },
    body: { id: 'whatever', status: 'confirmed' }
  });
  const res = fakeRes();

  await handler(req, res);

  assert.equal(res.statusCode, 401);
});
