import assert from 'node:assert/strict';
import test from 'node:test';
import { authenticateClerkRequest, parseAuthorizedParties } from '../server/auth.mjs';
import { createWorker } from '../server/worker.mjs';

function bindings() {
  const attestations = new Map();
  const objects = new Map();
  return {
    env: {
      DB: {
        prepare(sql) {
          return {
            bind(...values) {
              return {
                async first() {
                  const [userId, policy] = values;
                  return attestations.get(userId) === policy ? { allowed: 1 } : null;
                },
                async run() {
                  const [userId, , policy] = values;
                  attestations.set(userId, policy);
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
      AGE_POLICY_VERSION: '1',
      CLERK_PUBLISHABLE_KEY: 'pk_test_example',
    },
    objects,
  };
}

const auth = async (request) => {
  const token = request.headers.get('authorization');
  if (!token) return { ok: false, status: 401 };
  if (token === 'Bearer fail') return { ok: false, status: 503 };
  return { ok: true, userId: 'user_123' };
};

function request(path, options = {}) {
  return new Request(`https://site.test${path}`, options);
}

test('protected media requires authentication and current 18+ attestation', async () => {
  const { env } = bindings();
  const worker = createWorker({ authenticate: auth, seedPayloads: { 'creator-1': new Uint8Array([255, 216, 255, 217]) } });
  assert.equal((await worker.fetch(request('/api/media/creator-1'), env)).status, 401);

  const headers = { authorization: 'Bearer valid' };
  assert.equal((await worker.fetch(request('/api/media/creator-1', { headers }), env)).status, 403);
  assert.equal((await worker.fetch(request('/api/age-attestation', {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ confirmed: true }),
  }), env)).status, 204);

  const response = await worker.fetch(request('/api/media/creator-1', { headers }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [255, 216, 255, 217]);
});

test('attestation is explicit, idempotent, and policy bound', async () => {
  const { env } = bindings();
  const worker = createWorker({ authenticate: auth, seedPayloads: {} });
  const headers = { authorization: 'Bearer valid', 'content-type': 'application/json' };
  assert.equal((await worker.fetch(request('/api/age-attestation', { method: 'POST', headers, body: JSON.stringify({ confirmed: false }) }), env)).status, 400);
  assert.equal((await worker.fetch(request('/api/age-attestation', { method: 'POST', headers, body: JSON.stringify({ confirmed: true }) }), env)).status, 204);
  assert.equal((await worker.fetch(request('/api/age-attestation', { method: 'POST', headers, body: JSON.stringify({ confirmed: true }) }), env)).status, 204);
  env.AGE_POLICY_VERSION = '2';
  const status = await worker.fetch(request('/api/access-status', { headers }), env);
  assert.deepEqual(await status.json(), { authenticated: true, ageAttested: false });
});

test('attestation is isolated to the authenticated Clerk user', async () => {
  const { env } = bindings();
  const authenticateByUser = async (incomingRequest) => {
    const userId = incomingRequest.headers.get('x-test-user');
    return userId ? { ok: true, userId } : { ok: false, status: 401 };
  };
  const worker = createWorker({ authenticate: authenticateByUser, seedPayloads: { 'creator-1': new Uint8Array([1]) } });
  const userOneHeaders = { 'x-test-user': 'user_one', 'content-type': 'application/json' };
  assert.equal((await worker.fetch(request('/api/age-attestation', {
    method: 'POST', headers: userOneHeaders, body: JSON.stringify({ confirmed: true }),
  }), env)).status, 204);
  assert.equal((await worker.fetch(request('/api/media/creator-1', { headers: { 'x-test-user': 'user_one' } }), env)).status, 200);
  assert.equal((await worker.fetch(request('/api/media/creator-1', { headers: { 'x-test-user': 'user_two' } }), env)).status, 403);
});

test('media IDs are allowlisted and infrastructure failures fail closed', async () => {
  const { env } = bindings();
  const worker = createWorker({ authenticate: auth, seedPayloads: {} });
  const headers = { authorization: 'Bearer valid' };
  assert.equal((await worker.fetch(request('/api/media/not-real', { headers }), env)).status, 404);
  assert.equal((await worker.fetch(request('/api/access-status', { headers: { authorization: 'Bearer fail' } }), env)).status, 503);
});

test('Clerk auth accepts only configured session requests and fails closed', async () => {
  assert.deepEqual(parseAuthorizedParties(' https://site.test, http://localhost:4173 '), ['https://site.test', 'http://localhost:4173']);
  const requestWithToken = request('/api/access-status', { headers: { authorization: 'Bearer session' } });
  const env = {
    CLERK_PUBLISHABLE_KEY: 'pk_test_example',
    CLERK_SECRET_KEY: 'test-secret',
    CLERK_AUTHORIZED_PARTIES: 'https://site.test',
  };
  let receivedOptions;
  const authenticated = await authenticateClerkRequest(requestWithToken, env, () => ({
    authenticateRequest: async (_request, options) => {
      receivedOptions = options;
      return { isAuthenticated: true, toAuth: () => ({ userId: 'user_123' }) };
    },
  }));
  assert.deepEqual(authenticated, { ok: true, userId: 'user_123' });
  assert.deepEqual(receivedOptions, { acceptsToken: 'session_token', authorizedParties: ['https://site.test'] });
  assert.deepEqual(await authenticateClerkRequest(requestWithToken, {}, () => { throw new Error('must not run'); }), { ok: false, status: 503 });
  assert.deepEqual(await authenticateClerkRequest(requestWithToken, env, () => ({ authenticateRequest: async () => ({ isAuthenticated: false }) })), { ok: false, status: 401 });
  assert.deepEqual(await authenticateClerkRequest(requestWithToken, env, () => { throw new Error('unavailable'); }), { ok: false, status: 503 });
});

test('API methods and D1 or R2 failures cannot bypass the 18+ gate', async () => {
  const { env } = bindings();
  const headers = { authorization: 'Bearer valid', 'content-type': 'application/json' };
  const worker = createWorker({ authenticate: auth, seedPayloads: { 'creator-1': new Uint8Array([1]) } });
  assert.equal((await worker.fetch(request('/api/access-status', { method: 'POST', headers }), env)).status, 405);
  assert.equal((await worker.fetch(request('/api/age-attestation', { method: 'GET', headers }), env)).status, 405);
  assert.equal((await worker.fetch(request('/api/media/creator-1', { method: 'POST', headers }), env)).status, 405);
  assert.equal((await worker.fetch(request('/api/age-attestation', { method: 'POST', headers: { authorization: 'Bearer valid' }, body: JSON.stringify({ confirmed: true }) }), env)).status, 400);

  const brokenDbEnv = { ...env, DB: { prepare: () => { throw new Error('D1 unavailable'); } } };
  assert.equal((await worker.fetch(request('/api/access-status', { headers }), brokenDbEnv)).status, 503);

  await worker.fetch(request('/api/age-attestation', { method: 'POST', headers, body: JSON.stringify({ confirmed: true }) }), env);
  const brokenMediaEnv = { ...env, MEDIA: { get: async () => { throw new Error('R2 unavailable'); } } };
  assert.equal((await worker.fetch(request('/api/media/creator-1', { headers }), brokenMediaEnv)).status, 503);

  const missingPolicyEnv = { ...env };
  delete missingPolicyEnv.AGE_POLICY_VERSION;
  assert.equal((await worker.fetch(request('/api/access-status', { headers }), missingPolicyEnv)).status, 503);

  const invalidSessionWorker = createWorker({ authenticate: async () => ({ ok: false, status: 401 }), seedPayloads: { 'creator-1': new Uint8Array([1]) } });
  assert.equal((await invalidSessionWorker.fetch(request('/api/media/creator-1', { headers }), env)).status, 401);
});
