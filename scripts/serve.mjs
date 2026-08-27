import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { liveSources } from '../site-config.mjs';
import { createWorker } from '../server/worker.mjs';

const outputRoot = path.resolve(process.cwd(), 'dist');
const port = Number(process.env.PORT || 4173);
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
};
const publicFiles = new Set([
  'index.html',
  'styles.css',
  'script.js',
  'tracking.js',
  'live.html',
  'live.css',
  'live.js',
  'robots.txt',
  'assets/hero-abstract.png',
]);

if (!existsSync(outputRoot)) {
  console.error('Missing dist/. Run npm run build before npm run preview.');
  process.exit(1);
}

function localPreviewWorker() {
  const testAuth = process.env.LOCAL_AUTH_TEST_MODE === '1';
  const clerkAuth = Boolean(process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
  if (!testAuth && !clerkAuth) return null;
  const attestations = new Map();
  const objects = new Map();
  const env = {
    AGE_POLICY_VERSION: process.env.AGE_POLICY_VERSION || '1',
    CLERK_AUTHORIZED_PARTIES: process.env.CLERK_AUTHORIZED_PARTIES || `http://localhost:${port}`,
    CLERK_PUBLISHABLE_KEY: testAuth ? 'pk_test_local_only' : process.env.CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    DB: {
      prepare() {
        return { bind(...values) { return {
          first: async () => {
            const [userId, policyVersion] = values;
            return attestations.get(userId) === policyVersion ? { allowed: 1 } : null;
          },
          run: async () => {
            const [userId, , policyVersion] = values;
            attestations.set(userId, policyVersion);
            return { success: true };
          },
        }; } };
      },
    },
    MEDIA: {
      get: async (key) => objects.has(key) ? { arrayBuffer: async () => objects.get(key).buffer } : null,
      put: async (key, value) => { objects.set(key, new Uint8Array(value)); },
    },
  };
  const options = {
    pages: {
      home: readFileSync(path.join(outputRoot, 'index.html'), 'utf8'),
      live: readFileSync(path.join(outputRoot, 'live.html'), 'utf8'),
      livePaths: new Set(['/live', ...liveSources.map((source) => `/live/${source}`)]),
      robots: readFileSync(path.join(outputRoot, 'robots.txt'), 'utf8'),
    },
    seedPayloads: {
      'creator-1': new Uint8Array(readFileSync(path.resolve(process.cwd(), 'protected-media', 'creator-censored-1.jpg'))),
      'creator-2': new Uint8Array(readFileSync(path.resolve(process.cwd(), 'protected-media', 'creator-censored-2.jpg'))),
    },
  };
  if (testAuth) {
    options.authenticate = async (request) => request.headers.get('authorization') === 'Bearer local-test-token'
      ? { ok: true, userId: 'local_test_user' }
      : { ok: false, status: 401 };
  }
  const worker = createWorker(options);
  return { worker, env };
}

const localWorker = localPreviewWorker();

createServer(async (request, response) => {
  const requestedPath = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
  if (localWorker && (requestedPath.startsWith('/api/') || requestedPath === '/')) {
    const body = ['GET', 'HEAD'].includes(request.method || 'GET') ? undefined : await new Promise((resolve, reject) => {
      const chunks = [];
      request.on('data', (chunk) => chunks.push(chunk));
      request.on('end', () => resolve(Buffer.concat(chunks)));
      request.on('error', reject);
    });
    const result = await localWorker.worker.fetch(new Request(`http://localhost:${port}${request.url}`, {
      method: request.method,
      headers: request.headers,
      body,
    }), localWorker.env);
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(Buffer.from(await result.arrayBuffer()));
    return;
  }
  const isLiveRoute = requestedPath === '/live' || liveSources.some((source) => requestedPath === `/live/${source}`);
  const relativePath = requestedPath === '/' ? 'index.html' : isLiveRoute ? 'live.html' : requestedPath.replace(/^[/\\]+/, '');
  if (!publicFiles.has(relativePath)) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  const filePath = path.resolve(outputRoot, relativePath);

  if (!filePath.startsWith(`${outputRoot}${path.sep}`) && filePath !== outputRoot) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': types[path.extname(filePath)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(filePath).pipe(response);
}).listen(port, () => {
  const localApiStatus = !localWorker
    ? ' with protected APIs fail-closed.'
    : process.env.LOCAL_AUTH_TEST_MODE === '1'
      ? ' with test-only local APIs.'
      : ' with Clerk-backed local APIs.';
  console.log(`Preview running at http://localhost:${port}${localApiStatus}`);
});
