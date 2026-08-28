import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorker } from '../server/worker.mjs';

function bindings() {
  const sessions = new Map();
  const writes = [];
  const objects = new Map();
  const env = {
    AGE_POLICY_VERSION: '1',
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            return {
              async first() {
                const [tokenHash, policyVersion, now] = values;
                const row = sessions.get(tokenHash);
                return row && row.policyVersion === policyVersion && row.expiresAt > now
                  ? { allowed: 1 }
                  : null;
              },
              async run() {
                if (/^DELETE FROM preview_sessions/u.test(sql)) {
                  const [cutoff] = values;
                  for (const [tokenHash, row] of sessions) {
                    if (row.expiresAt <= cutoff) sessions.delete(tokenHash);
                  }
                  return { success: true };
                }
                const [tokenHash, attestedAt, expiresAt, policyVersion] = values;
                writes.push({ tokenHash, attestedAt, expiresAt, policyVersion, sql });
                sessions.set(tokenHash, { attestedAt, expiresAt, policyVersion });
                return { success: true };
              },
            };
          },
        };
      },
    },
    MEDIA: {
      async get(key) {
        const value = objects.get(key);
        return value ? { arrayBuffer: async () => value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) } : null;
      },
      async put(key, value) { objects.set(key, new Uint8Array(value)); },
    },
  };
  return { env, sessions, writes, objects };
}

function request(path, options = {}) {
  return new Request(`https://site.test${path}`, options);
}

function cookiePair(response) {
  return response.headers.get('set-cookie')?.split(';', 1)[0] || '';
}

async function confirm(worker, env, options = {}) {
  return worker.fetch(request(options.path || '/api/preview-session', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    body: JSON.stringify({ confirmed: true }),
  }), env);
}

test('anonymous confirmation creates one 30-day opaque HttpOnly session and D1 stores only its hash', async () => {
  const { env, writes } = bindings();
  const worker = createWorker({
    now: () => new Date('2026-08-28T12:00:00.000Z'),
    randomBytes: () => Uint8Array.from({ length: 32 }, (_, index) => index),
  });

  const initial = await worker.fetch(request('/api/preview-session'), env);
  assert.equal(initial.status, 200);
  assert.deepEqual(await initial.json(), { ageAttested: false });

  const confirmation = await confirm(worker, env);
  assert.equal(confirmation.status, 204);
  const setCookie = confirmation.headers.get('set-cookie');
  assert.match(setCookie, /^__Host-stv_preview_access=[A-Za-z0-9_-]{43};/);
  for (const attribute of ['Path=/', 'Max-Age=2592000', 'HttpOnly', 'Secure', 'SameSite=Lax']) {
    assert.match(setCookie, new RegExp(attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(setCookie, /Domain=/i);

  assert.equal(writes.length, 1);
  const rawToken = cookiePair(confirmation).split('=', 2)[1];
  assert.match(writes[0].tokenHash, /^[a-f0-9]{64}$/);
  assert.notEqual(writes[0].tokenHash, rawToken);
  assert.deepEqual(
    { attestedAt: writes[0].attestedAt, expiresAt: writes[0].expiresAt, policyVersion: writes[0].policyVersion },
    { attestedAt: '2026-08-28T12:00:00.000Z', expiresAt: '2026-09-27T12:00:00.000Z', policyVersion: '1' },
  );

  const remembered = await worker.fetch(request('/api/preview-session', { headers: { cookie: cookiePair(confirmation) } }), env);
  assert.deepEqual(await remembered.json(), { ageAttested: true });
  const repeated = await confirm(worker, env, { headers: { cookie: cookiePair(confirmation) } });
  assert.equal(repeated.status, 204);
  assert.equal(repeated.headers.get('set-cookie'), null);
  assert.equal(writes.length, 1);
});

test('confirmation requires same-origin explicit JSON and failures never set access cookies', async () => {
  const { env } = bindings();
  const worker = createWorker({ randomBytes: () => new Uint8Array(32).fill(9) });

  assert.equal((await worker.fetch(request('/api/preview-session', { method: 'PUT' }), env)).status, 405);
  assert.equal((await worker.fetch(request('/api/preview-session', { method: 'POST', body: '{}' }), env)).status, 400);
  assert.equal((await worker.fetch(request('/api/preview-session', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirmed: false }),
  }), env)).status, 400);
  assert.equal((await confirm(worker, env, { headers: { origin: 'https://attacker.test' } })).status, 403);

  const brokenDb = { ...env, DB: { prepare: () => { throw new Error('D1 unavailable'); } } };
  const failed = await confirm(worker, brokenDb);
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.get('set-cookie'), null);

  const missingPolicy = { ...env };
  delete missingPolicy.AGE_POLICY_VERSION;
  assert.equal((await worker.fetch(request('/api/preview-session'), missingPolicy)).status, 503);
});

test('valid guest session retrieves allowlisted private R2 media with private cache headers', async () => {
  const { env } = bindings();
  const worker = createWorker({
    randomBytes: () => new Uint8Array(32).fill(7),
    seedPayloads: { 'creator-1': new Uint8Array([255, 216, 255, 217]) },
  });
  const cookie = cookiePair(await confirm(worker, env));

  assert.equal((await worker.fetch(request('/api/media/creator-1'), env)).status, 403);
  assert.equal((await worker.fetch(request('/api/media/not-real', { headers: { cookie } }), env)).status, 404);
  assert.equal((await worker.fetch(request('/api/media/creator-1', { method: 'POST', headers: { cookie } }), env)).status, 405);

  const media = await worker.fetch(request('/api/media/creator-1', { headers: { cookie } }), env);
  assert.equal(media.status, 200);
  assert.equal(media.headers.get('content-type'), 'image/jpeg');
  assert.equal(media.headers.get('cache-control'), 'private, no-store');
  assert.equal(media.headers.get('vary'), 'Cookie');
  assert.equal(media.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(media.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.deepEqual([...new Uint8Array(await media.arrayBuffer())], [255, 216, 255, 217]);
});

test('invalid, expired, deleted, and policy-stale sessions fail closed', async () => {
  const { env, sessions } = bindings();
  const clock = { now: new Date('2026-08-28T12:00:00.000Z') };
  const worker = createWorker({
    now: () => new Date(clock.now),
    randomBytes: () => new Uint8Array(32).fill(5),
    seedPayloads: { 'creator-1': new Uint8Array([1]) },
  });
  const cookie = cookiePair(await confirm(worker, env));

  assert.equal((await worker.fetch(request('/api/media/creator-1', { headers: { cookie: '__Host-stv_preview_access=invalid' } }), env)).status, 403);
  assert.equal((await worker.fetch(request('/api/media/creator-1', { headers: { cookie: `${cookie}; ${cookie}` } }), env)).status, 403);
  env.AGE_POLICY_VERSION = '2';
  assert.equal((await worker.fetch(request('/api/media/creator-1', { headers: { cookie } }), env)).status, 403);
  env.AGE_POLICY_VERSION = '1';
  clock.now = new Date('2026-09-27T12:00:00.001Z');
  assert.equal((await worker.fetch(request('/api/media/creator-1', { headers: { cookie } }), env)).status, 403);
  assert.deepEqual(await (await worker.fetch(request('/api/preview-session', { headers: { cookie } }), env)).json(), { ageAttested: false });
  sessions.clear();
  assert.equal((await worker.fetch(request('/api/media/creator-1', { headers: { cookie } }), env)).status, 403);
});

test('legacy access routes remain anonymous-session aliases without external identity auth', async () => {
  const { env } = bindings();
  const worker = createWorker({ randomBytes: () => new Uint8Array(32).fill(3) });

  const initial = await worker.fetch(request('/api/access-status'), env);
  assert.deepEqual(await initial.json(), { authenticated: false, ageAttested: false });
  const confirmation = await confirm(worker, env, { path: '/api/age-attestation' });
  assert.equal(confirmation.status, 204);
  const remembered = await worker.fetch(request('/api/access-status', { headers: { cookie: cookiePair(confirmation) } }), env);
  assert.deepEqual(await remembered.json(), { authenticated: false, ageAttested: true });
});

test('D1 and R2 errors return 503 without exposing exception details', async () => {
  const { env } = bindings();
  const worker = createWorker({
    randomBytes: () => new Uint8Array(32).fill(2),
    seedPayloads: { 'creator-1': new Uint8Array([1]) },
  });
  const cookie = cookiePair(await confirm(worker, env));
  const brokenDb = { ...env, DB: { prepare: () => { throw new Error('private D1 detail'); } } };
  const dbResponse = await worker.fetch(request('/api/preview-session', { headers: { cookie } }), brokenDb);
  assert.equal(dbResponse.status, 503);
  assert.doesNotMatch(await dbResponse.text(), /private D1 detail/);

  const brokenMedia = { ...env, MEDIA: { get: async () => { throw new Error('private R2 detail'); } } };
  const mediaResponse = await worker.fetch(request('/api/media/creator-1', { headers: { cookie } }), brokenMedia);
  assert.equal(mediaResponse.status, 503);
  assert.doesNotMatch(await mediaResponse.text(), /private R2 detail/);
});

test('HTTP redirects to HTTPS and all HTTPS responses advertise HSTS', async () => {
  const { env } = bindings();
  const worker = createWorker({ pages: { home: '<!doctype html><title>Home</title>' } });

  const redirect = await worker.fetch(new Request('http://site.test/path?source=x'), env);
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), 'https://site.test/path?source=x');

  for (const response of [
    await worker.fetch(request('/'), env),
    await worker.fetch(request('/api/preview-session'), env),
    await worker.fetch(request('/missing'), env),
  ]) {
    assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  }
});
