import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateSite } from './validate-site.mjs';

const sourceRoot = process.cwd();
const outputRoot = path.join(sourceRoot, 'dist');
const validation = validateSite(sourceRoot);

if (validation.errors.length > 0) {
  console.error('Build stopped because source validation failed:');
  for (const error of validation.errors) console.error('- ' + error);
  process.exit(1);
}

rmSync(outputRoot, { force: true, recursive: true });

const staticFiles = [
  'index.html',
  'styles.css',
  'script.js',
  'robots.txt',
];

for (const relativePath of staticFiles) {
  const destination = path.join(outputRoot, relativePath);
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(path.join(sourceRoot, relativePath), destination);
}

const html = readFileSync(path.join(sourceRoot, 'index.html'), 'utf8');
const css = readFileSync(path.join(sourceRoot, 'styles.css'), 'utf8');
const script = readFileSync(path.join(sourceRoot, 'script.js'), 'utf8');
const robots = readFileSync(path.join(sourceRoot, 'robots.txt'), 'utf8');
const inlineDocument = html
  .replace(/\s*<link rel="stylesheet" href="\.\/styles\.css" \/>\s*/, '\n    <style>' + css + '</style>\n')
  .replace(/\s*<script src="\.\/script\.js" defer><\/script>\s*/, '\n    <script>' + script + '</script>\n');
const workerSource =
  'const page = ' + JSON.stringify(inlineDocument) + ';\n' +
  'const robots = ' + JSON.stringify(robots) + ';\n\n' +
  'export default {\n' +
  '  async fetch(request) {\n' +
  '    const url = new URL(request.url);\n' +
  '    if (url.pathname === "/") {\n' +
  '      return new Response(page, {\n' +
  '        headers: {\n' +
  '          "cache-control": "public, max-age=300",\n' +
  '          "content-type": "text/html; charset=UTF-8",\n' +
  '        },\n' +
  '      });\n' +
  '    }\n' +
  '    if (url.pathname === "/robots.txt") {\n' +
  '      return new Response(robots, {\n' +
  '        headers: { "content-type": "text/plain; charset=UTF-8" },\n' +
  '      });\n' +
  '    }\n' +
  '    return new Response("Not found", { status: 404 });\n' +
  '  },\n' +
  '};\n';

const workerOutput = path.join(outputRoot, 'server', 'index.js');
mkdirSync(path.dirname(workerOutput), { recursive: true });
writeFileSync(workerOutput, workerSource);
mkdirSync(path.join(outputRoot, '.openai'), { recursive: true });
copyFileSync(
  path.join(sourceRoot, '.openai', 'hosting.json'),
  path.join(outputRoot, '.openai', 'hosting.json'),
);

const workerModule = await import(pathToFileURL(workerOutput).href + '?build=' + Date.now());
if (typeof workerModule.default?.fetch !== 'function') {
  throw new Error('Generated worker must export default.fetch.');
}

console.log(
  'Build complete: ' + staticFiles.length + ' static files and a Sites worker written to ' + outputRoot + '.',
);
