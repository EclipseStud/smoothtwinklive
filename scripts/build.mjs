import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { validateSite } from './validate-site.mjs';
import { getStripchatUrl, liveSources } from '../site-config.mjs';

const sourceRoot = process.cwd();
const outputRoot = path.join(sourceRoot, 'dist');
const validation = validateSite(sourceRoot);
if (validation.errors.length > 0) {
  console.error('Build stopped because source validation failed:');
  for (const error of validation.errors) console.error('- ' + error);
  process.exit(1);
}

rmSync(outputRoot, { force: true, recursive: true });
const staticFiles = ['index.html', 'styles.css', 'tracking.js', 'live.html', 'live.css', 'live.js', 'robots.txt', 'sitemap.xml', 'assets/hero-abstract.png'];
for (const relativePath of staticFiles) {
  const destination = path.join(outputRoot, relativePath);
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(path.join(sourceRoot, relativePath), destination);
}

const renderReferralUrl = (content) => content.replaceAll('{{STRIPCHAT_REFERRAL_URL}}', getStripchatUrl());
const home = renderReferralUrl(readFileSync(path.join(sourceRoot, 'index.html'), 'utf8'));
const live = renderReferralUrl(readFileSync(path.join(sourceRoot, 'live.html'), 'utf8'));
writeFileSync(path.join(outputRoot, 'index.html'), home);
writeFileSync(path.join(outputRoot, 'live.html'), live);

await build({ entryPoints:[path.join(sourceRoot, 'script.js')], outfile:path.join(outputRoot, 'script.js'), bundle:true, format:'iife', platform:'browser', target:'es2022', minify:true });

const generatedContent = path.join(sourceRoot, 'server', 'generated-content.mjs');
const productionEntry = path.join(sourceRoot, 'server', 'production-entry.mjs');
const livePaths = ['/live', ...liveSources.map((source) => `/live/${source}`)];
const payloads = {
  'creator-1': readFileSync(path.join(sourceRoot, 'protected-media', 'creator-censored-1.jpg')).toString('base64'),
  'creator-2': readFileSync(path.join(sourceRoot, 'protected-media', 'creator-censored-2.jpg')).toString('base64'),
};
writeFileSync(generatedContent, `export const home=${JSON.stringify(home)};\nexport const live=${JSON.stringify(live)};\nexport const livePaths=${JSON.stringify(livePaths)};\nexport const robots=${JSON.stringify(readFileSync(path.join(sourceRoot, 'robots.txt'), 'utf8'))};\nexport const payloads=${JSON.stringify(payloads)};\n`);
writeFileSync(productionEntry, `import { createWorker } from './worker.mjs';\nimport { home, live, livePaths, robots, payloads } from './generated-content.mjs';\nconst decode=(value)=>Uint8Array.from(atob(value),(character)=>character.charCodeAt(0));\nconst seedPayloads=Object.fromEntries(Object.entries(payloads).map(([key,value])=>[key,decode(value)]));\nexport default createWorker({pages:{home,live,livePaths:new Set(livePaths),robots},seedPayloads});\n`);

mkdirSync(path.join(outputRoot, 'server'), { recursive: true });
await build({ entryPoints:[productionEntry], outfile:path.join(outputRoot, 'server', 'index.js'), bundle:true, format:'esm', platform:'browser', target:'es2022', minify:true });

mkdirSync(path.join(outputRoot, '.openai', 'drizzle'), { recursive: true });
copyFileSync(path.join(sourceRoot, '.openai', 'hosting.json'), path.join(outputRoot, '.openai', 'hosting.json'));
copyFileSync(path.join(sourceRoot, '.openai', 'drizzle', '0001_age_attestations.sql'), path.join(outputRoot, '.openai', 'drizzle', '0001_age_attestations.sql'));
console.log(`Build complete: ${staticFiles.length + 1} public static files, protected Worker, D1 migration.`);
