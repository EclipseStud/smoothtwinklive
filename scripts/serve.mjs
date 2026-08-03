import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

const outputRoot = path.resolve(process.cwd(), 'dist');
const port = Number(process.env.PORT || 4173);
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
};

if (!existsSync(outputRoot)) {
  console.error('Missing dist/. Run npm run build before npm run preview.');
  process.exit(1);
}

createServer((request, response) => {
  const requestedPath = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
  const relativePath = requestedPath === '/' ? 'index.html' : requestedPath.replace(/^[/\\]+/, '');
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
  console.log(`Preview running at http://localhost:${port}`);
});
