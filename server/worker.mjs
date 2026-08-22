import { authenticateClerkRequest } from './auth.mjs';
import { hasCurrentAttestation, recordAttestation } from './age-attestations.mjs';
import { getProtectedMedia, MEDIA_BY_ID } from './protected-media.mjs';

const privateHeaders = { 'Cache-Control': 'private, no-store', 'Vary': 'Authorization, Cookie' };
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { ...privateHeaders, 'Content-Type': 'application/json; charset=UTF-8' },
});

export function createWorker({ authenticate = authenticateClerkRequest, pages = {}, seedPayloads = {} } = {}) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (url.pathname === '/' && pages.home) return new Response(pages.home.replaceAll('{{CLERK_PUBLISHABLE_KEY}}', env.CLERK_PUBLISHABLE_KEY || ''), { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
      if (pages.livePaths?.has(url.pathname)) return new Response(pages.live, { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
      if (url.pathname === '/robots.txt' && pages.robots) return new Response(pages.robots, { headers: { 'Content-Type': 'text/plain; charset=UTF-8' } });

      const mediaMatch = url.pathname.match(/^\/api\/media\/([^/]+)$/);
      const isApi = url.pathname === '/api/access-status' || url.pathname === '/api/age-attestation' || mediaMatch;
      if (!isApi) return new Response('Not found', { status: 404 });
      if (mediaMatch && !MEDIA_BY_ID[mediaMatch[1]]) return new Response('Not found', { status: 404 });
      if (url.pathname === '/api/access-status' && request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: privateHeaders });
      if (url.pathname === '/api/age-attestation' && request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: privateHeaders });
      if (mediaMatch && request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: privateHeaders });

      const authentication = await authenticate(request, env);
      if (!authentication.ok) return new Response(authentication.status === 401 ? 'Unauthorized' : 'Service unavailable', { status: authentication.status, headers: privateHeaders });
      const policyVersion = env.AGE_POLICY_VERSION?.trim();
      if (!policyVersion) return new Response('Service unavailable', { status: 503, headers: privateHeaders });
      try {
        if (url.pathname === '/api/access-status') {
          return json({ authenticated: true, ageAttested: await hasCurrentAttestation(env.DB, authentication.userId, policyVersion) });
        }
        if (url.pathname === '/api/age-attestation') {
          if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
            return json({ error: 'Confirmation required' }, 400);
          }
          let body;
          try { body = await request.json(); } catch { return json({ error: 'Confirmation required' }, 400); }
          if (body?.confirmed !== true) return json({ error: 'Confirmation required' }, 400);
          await recordAttestation(env.DB, authentication.userId, policyVersion);
          return new Response(null, { status: 204, headers: privateHeaders });
        }
        if (!await hasCurrentAttestation(env.DB, authentication.userId, policyVersion)) return new Response('Forbidden', { status: 403, headers: privateHeaders });
        return getProtectedMedia(env, mediaMatch[1], seedPayloads);
      } catch {
        return new Response('Service unavailable', { status: 503, headers: privateHeaders });
      }
    },
  };
}

export default createWorker();
