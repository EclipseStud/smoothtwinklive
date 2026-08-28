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
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};
const publicFiles = new Set([
  'index.html', 'styles.css', 'script.js', 'tracking.js',
  'why-follow.html', 'why-follow.js',
  'live.html', 'live.css', 'live.js',
  'robots.txt', 'sitemap.xml',
  'assets/hero-abstract.png', 'assets/creator-placeholder-v1-768.jpg', 'assets/creator-placeholder-v1-1536.jpg',
]);

if (!existsSync(outputRoot)) {
  console.error('Missing dist/. Run npm run build before npm run preview.');
  process.exit(1);
}

function localPreviewWorker() {
  const sessions = new Map();
  const objects = new Map();
  const env = {
    AGE_POLICY_VERSION: process.env.AGE_POLICY_VERSION || '1',
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            return {
              async first() {
                const [tokenHash, policyVersion, now] = values;
                const row = sessions.get(tokenHash);
                return row && row.policyVersion === policyVersion && row.expiresAt > now ? { allowed: 1 } : null;
              },
              async run() {
                if (/^DELETE FROM preview_sessions/u.test(sql)) {
                  const [cutoff] = values;
                  for (const [tokenHash, row] of sessions) if (row.expiresAt <= cutoff) sessions.delete(tokenHash);
                  return { success: true };
                }
                const [tokenHash, attestedAt, expiresAt, policyVersion] = values;
                sessions.set(tokenHash, { attestedAt, expiresAt, policyVersion });
                return { success: true };
              },
            };
          },
        };
      },
    },
    MEDIA: {
      get: async (key) => objects.has(key) ? { arrayBuffer: async () => objects.get(key).buffer } : null,
      put: async (key, value) => { objects.set(key, new Uint8Array(value)); },
    },
  };
  const worker = createWorker({
    enforceHttps: false,
    pages: {
      home: readFileSync(path.join(outputRoot, 'index.html'), 'utf8'),
      whyFollow: readFileSync(path.join(outputRoot, 'why-follow.html'), 'utf8'),
      live: readFileSync(path.join(outputRoot, 'live.html'), 'utf8'),
      livePaths: new Set(['/live', ...liveSources.map((source) => `/live/${source}`)]),
      robots: readFileSync(path.join(outputRoot, 'robots.txt'), 'utf8'),
    },
    seedPayloads: {
      'creator-1': new Uint8Array(readFileSync(path.resolve(process.cwd(), 'protected-media', 'creator-censored-1.jpg'))),
      'creator-2': new Uint8Array(readFileSync(path.resolve(process.cwd(), 'protected-media', 'creator-censored-2.jpg'))),
    },
  });
  return { worker, env };
}

const localWorker = localPreviewWorker();

createServer(async (incoming, outgoing) => {
  const requestedPath = decodeURIComponent(new URL(incoming.url || '/', 'http://localhost').pathname);
  const isWorkerRoute = requestedPath.startsWith('/api/')
    || requestedPath === '/'
    || requestedPath === '/why-follow'
    || requestedPath === '/live'
    || requestedPath === '/robots.txt'
    || liveSources.some((source) => requestedPath === `/live/${source}`);

  if (isWorkerRoute) {
    const body = ['GET', 'HEAD'].includes(incoming.method || 'GET') ? undefined : await new Promise((resolve, reject) => {
      const chunks = [];
      incoming.on('data', (chunk) => chunks.push(chunk));
      incoming.on('end', () => resolve(Buffer.concat(chunks)));
      incoming.on('error', reject);
    });
    const result = await localWorker.worker.fetch(new Request(`http://localhost:${port}${incoming.url}`, {
      method: incoming.method,
      headers: incoming.headers,
      body,
    }), localWorker.env);
    outgoing.writeHead(result.status, Object.fromEntries(result.headers));
    outgoing.end(Buffer.from(await result.arrayBuffer()));
    return;
  }

  const relativePath = requestedPath.replace(/^[/\\]+/, '');
  if (!publicFiles.has(relativePath)) {
    outgoing.writeHead(404);
    outgoing.end('Not found');
    return;
  }
  const filePath = path.resolve(outputRoot, relativePath);
  if (!filePath.startsWith(`${outputRoot}${path.sep}`) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    outgoing.writeHead(404);
    outgoing.end('Not found');
    return;
  }
  outgoing.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(filePath).pipe(outgoing);
}).listen(port, () => {
  console.log(`Preview running at http://localhost:${port} with anonymous D1 preview sessions.`);
});
