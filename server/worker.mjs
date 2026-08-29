import { getProtectedMedia, MEDIA_BY_ID } from './protected-media.mjs';
import { createPreviewSession, hasValidPreviewSession, previewSessionCookie } from './preview-sessions.mjs';

const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
};

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { ...privateHeaders, 'Content-Type': 'application/json; charset=UTF-8' },
});

function secured(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function httpsRedirect(request) {
  const url = new URL(request.url);
  if (url.protocol === 'https:') return null;
  url.protocol = 'https:';
  return new Response(null, { status: 308, headers: { Location: url.toString() } });
}

function pageResponse(content, request) {
  return new Response(request.method === 'HEAD' ? null : content, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' },
  });
}

async function confirmationBody(request) {
  const mediaType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (mediaType !== 'application/json') return null;
  const announcedLength = Number(request.headers.get('content-length') || 0);
  if (announcedLength > 64) return null;
  const source = await request.text();
  if (source.length > 64) return null;
  try { return JSON.parse(source); } catch { return null; }
}

export function createWorker({
  pages = {},
  seedPayloads = {},
  now = () => new Date(),
  randomBytes,
  enforceHttps = true,
} = {}) {
  return {
    async fetch(request, env) {
      if (enforceHttps) {
        const redirect = httpsRedirect(request);
        if (redirect) return secured(redirect);
      }

      const url = new URL(request.url);
      const isPageMethod = request.method === 'GET' || request.method === 'HEAD';
      if (isPageMethod && url.pathname === '/' && pages.home) return secured(pageResponse(pages.home, request));
      if (isPageMethod && url.pathname === '/why-follow' && pages.whyFollow) return secured(pageResponse(pages.whyFollow, request));
      if (isPageMethod && pages.livePaths?.has(url.pathname)) return secured(pageResponse(pages.live, request));
      if (isPageMethod && url.pathname === '/robots.txt' && pages.robots) {
        return secured(new Response(request.method === 'HEAD' ? null : pages.robots, { headers: { 'Content-Type': 'text/plain; charset=UTF-8' } }));
      }
      if (isPageMethod && !url.pathname.startsWith('/api/') && env.ASSETS?.fetch) {
        return secured(await env.ASSETS.fetch(request));
      }

      const mediaMatch = url.pathname.match(/^\/api\/media\/([^/]+)$/);
      const isPreviewStatus = url.pathname === '/api/preview-session' || url.pathname === '/api/access-status';
      const isPreviewConfirmation = url.pathname === '/api/preview-session' || url.pathname === '/api/age-attestation';
      const isApi = isPreviewStatus || isPreviewConfirmation || mediaMatch;
      if (!isApi) return secured(new Response('Not found', { status: 404 }));
      if (mediaMatch && !MEDIA_BY_ID[mediaMatch[1]]) return secured(new Response('Not found', { status: 404 }));

      if (url.pathname === '/api/preview-session' && !['GET', 'POST'].includes(request.method)) {
        return secured(new Response('Method not allowed', { status: 405, headers: privateHeaders }));
      }
      if (url.pathname === '/api/access-status' && request.method !== 'GET') {
        return secured(new Response('Method not allowed', { status: 405, headers: privateHeaders }));
      }
      if (url.pathname === '/api/age-attestation' && request.method !== 'POST') {
        return secured(new Response('Method not allowed', { status: 405, headers: privateHeaders }));
      }
      if (mediaMatch && request.method !== 'GET') {
        return secured(new Response('Method not allowed', { status: 405, headers: privateHeaders }));
      }

      const policyVersion = env.AGE_POLICY_VERSION?.trim();
      if (!policyVersion) return secured(new Response('Service unavailable', { status: 503, headers: privateHeaders }));

      if (isPreviewStatus && request.method === 'GET') {
        try {
          const ageAttested = await hasValidPreviewSession(env.DB, request, policyVersion, now());
          const value = url.pathname === '/api/access-status'
            ? { authenticated: false, ageAttested }
            : { ageAttested };
          return secured(json(value));
        } catch {
          return secured(new Response('Service unavailable', { status: 503, headers: privateHeaders }));
        }
      }

      if (isPreviewConfirmation && request.method === 'POST') {
        const origin = request.headers.get('origin');
        if (origin && origin !== url.origin) return secured(new Response('Forbidden', { status: 403, headers: privateHeaders }));
        const body = await confirmationBody(request);
        if (body?.confirmed !== true) return secured(json({ error: 'Confirmation required' }, 400));
        try {
          if (await hasValidPreviewSession(env.DB, request, policyVersion, now())) {
            return secured(new Response(null, { status: 204, headers: privateHeaders }));
          }
          const token = await createPreviewSession(env.DB, policyVersion, now(), randomBytes);
          return secured(new Response(null, {
            status: 204,
            headers: { ...privateHeaders, 'Set-Cookie': previewSessionCookie(token) },
          }));
        } catch {
          return secured(new Response('Service unavailable', { status: 503, headers: privateHeaders }));
        }
      }

      try {
        if (!await hasValidPreviewSession(env.DB, request, policyVersion, now())) {
          return secured(new Response('Forbidden', { status: 403, headers: privateHeaders }));
        }
        return secured(await getProtectedMedia(env, mediaMatch[1], seedPayloads));
      } catch {
        return secured(new Response('Service unavailable', { status: 503, headers: privateHeaders }));
      }
    },
  };
}

export default createWorker();
