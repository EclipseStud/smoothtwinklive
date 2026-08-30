import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { getStripchatUrl } from '../site-config.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const validator = path.join(projectRoot, 'scripts', 'validate-site.mjs');
const builder = path.join(projectRoot, 'scripts', 'build.mjs');
const canonicalCta = getStripchatUrl();

function runValidator() {
  return spawnSync(process.execPath, [validator], { cwd: projectRoot, encoding: 'utf8' });
}

function runBuild() {
  return spawnSync(process.execPath, [builder], { cwd: projectRoot, encoding: 'utf8' });
}

test('premium SmoothTwinkVibes source passes its production validator', () => {
  const result = runValidator();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Validation passed:/);
});

test('homepage exposes a dense creator funnel without account-wall language', async () => {
  const [home, styles] = await Promise.all([
    readFile(path.join(projectRoot, 'index.html'), 'utf8'),
    readFile(path.join(projectRoot, 'styles.css'), 'utf8'),
  ]);

  for (const line of ['WATCH ME', 'LIVE ON', 'STRIPCHAT.']) assert.match(home, new RegExp(`class="headline-line(?: accent-line)?"[^>]*>${line.replace('.', '\\.')}`));
  for (const label of ['18+ ONLY', 'LIVE CREATOR', 'DIRECT PROFILE', 'PREVIEW AVAILABLE']) assert.ok(home.includes(label), `Missing trust label: ${label}`);
  assert.ok((home.match(/class="benefit-card/g) || []).length >= 4);
  assert.match(home, /I'M 18\+ — SHOW PREVIEWS/);
  assert.match(home, /data-preview-confirm/);
  assert.ok((home.match(/data-protected-media/g) || []).length >= 2);
  assert.match(home, /assets\/creator-placeholder-v1-1536\.jpg/);
  assert.match(home, /srcset=/);
  for (const crop of ['hero', 'left', 'right', 'detail']) assert.match(home, new RegExp(`data-placeholder-crop="${crop}"`));
  assert.doesNotMatch(home, /\bLOCKED\b|\bUNLOCK\w*\b|CENSORED PUBLIC PREVIEW|SIGN IN|CREATE ACCOUNT|CLERK/i);
  assert.doesNotMatch(home, /viewer(?:s| count)?|countdown|limited[- ]time|LIVE NOW/i);
  for (const location of ['hero', 'preview_mid', 'lower', 'final', 'sticky_mobile']) {
    assert.match(home, new RegExp(`data-cta-location="${location}"`));
  }
  assert.ok((home.match(/<details\b/g) || []).length >= 5);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /safe-area-inset-bottom/);
  assert.match(styles, /@media \(max-width: 22rem\)/);
});

test('WHY FOLLOW is a dedicated same-site page, not a homepage scroll target', async () => {
  const [home, whyFollow] = await Promise.all([
    readFile(path.join(projectRoot, 'index.html'), 'utf8'),
    readFile(path.join(projectRoot, 'why-follow.html'), 'utf8'),
  ]);

  assert.match(home, /href="\/why-follow"[^>]*>WHY FOLLOW/);
  assert.doesNotMatch(home, /href="#benefits"[^>]*>WHY FOLLOW/);
  assert.match(whyFollow, /<link rel="canonical" href="https:\/\/smoothtwinklive\.com\/why-follow"/);
  assert.match(whyFollow, /WHY FOLLOW[\s\S]*SMOOTHTWINKVIBES/);
  assert.match(whyFollow, /href="\/"/);
  assert.match(whyFollow, /href="\/#preview"/);
  assert.match(whyFollow, /href="\/#faq"/);
  assert.ok((whyFollow.match(/data-referral-link/g) || []).length >= 2);
  assert.doesNotMatch(whyFollow, /exclusive clips|early access|guaranteed|discount|free tokens|viewer count/i);
});

test('live source routes use SmoothTwinkVibes branding and the dedicated WHY FOLLOW page', async () => {
  const [live, config, liveScript, trackingScript] = await Promise.all([
    readFile(path.join(projectRoot, 'live.html'), 'utf8'),
    readFile(path.join(projectRoot, 'site-config.mjs'), 'utf8'),
    readFile(path.join(projectRoot, 'live.js'), 'utf8'),
    readFile(path.join(projectRoot, 'tracking.js'), 'utf8'),
  ]);

  assert.match(config, /STRIPCHAT_USER_ID = 'SmoothTwinkVibes'/);
  assert.match(live, /SMOOTHTWINKVIBES/);
  assert.match(live, /WATCH ME LIVE/);
  assert.match(live, /href="\/why-follow"/);
  assert.doesNotMatch(live, /ECLIPSESTUD/i);
  assert.match(liveScript, /live_page_view/);
  assert.match(liveScript, /stripchat_cta_click/);
  assert.match(trackingScript, /sessionStorage/);
});

test('SEO surface keeps canonical metadata and adds only intended public routes', async () => {
  const [home, live, whyFollow, robots, sitemap] = await Promise.all([
    readFile(path.join(projectRoot, 'index.html'), 'utf8'),
    readFile(path.join(projectRoot, 'live.html'), 'utf8'),
    readFile(path.join(projectRoot, 'why-follow.html'), 'utf8'),
    readFile(path.join(projectRoot, 'robots.txt'), 'utf8'),
    readFile(path.join(projectRoot, 'sitemap.xml'), 'utf8'),
  ]);
  const origin = 'https://smoothtwinklive.com';
  for (const [page, pathname] of [[home, '/'], [live, '/live'], [whyFollow, '/why-follow']]) {
    assert.ok(page.includes(`<link rel="canonical" href="${origin}${pathname}" />`));
    assert.ok(page.includes(`<meta property="og:url" content="${origin}${pathname}" />`));
    assert.match(page, /<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" \/>/);
    assert.match(page, /<script type="application\/ld\+json">[\s\S]*"@context": "https:\/\/schema\.org"/);
    assert.doesNotMatch(page, /http:\/\//i);
  }
  assert.match(home, /"@type": "WebSite"/);
  assert.match(live, /"@type": "WebPage"/);
  assert.match(whyFollow, /"@type": "WebPage"/);
  assert.match(robots, /Sitemap: https:\/\/smoothtwinklive\.com\/sitemap\.xml/);
  for (const pathname of ['/', '/live', '/why-follow']) assert.match(sitemap, new RegExp(`<loc>${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${pathname.replace('/', '\\/')}</loc>`));
  assert.doesNotMatch(sitemap, /api\/|protected-media|creator-censored/i);
});

test('tracking remains first-party and canonical CTA authority remains unchanged', async () => {
  const trackingScript = await readFile(path.join(projectRoot, 'tracking.js'), 'utf8');
  assert.equal(canonicalCta, 'https://stripchat.com/SmoothTwinkVibes/follow-me');
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'sessionStorage']) assert.match(trackingScript, new RegExp(key));
  assert.doesNotMatch(trackingScript, /fetch\s*\(|XMLHttpRequest|navigator\.sendBeacon/);
});

test('production build keeps protected media private and contains no Clerk runtime', async () => {
  const result = runBuild();
  assert.equal(result.status, 0, result.stderr || result.stdout);

  for (const relativePath of [
    'assets/creator-censored-1.jpg',
    'assets/creator-censored-2.jpg',
    'protected-media',
  ]) assert.equal(existsSync(path.join(projectRoot, 'dist', relativePath)), false);
  for (const relativePath of [
    'why-follow.html',
    'why-follow.js',
    'assets/creator-placeholder-v1-768.jpg',
    'assets/creator-placeholder-v1-1536.jpg',
    '.openai/drizzle/0001_age_attestations.sql',
    '.openai/drizzle/0002_preview_sessions.sql',
  ]) assert.equal(existsSync(path.join(projectRoot, 'dist', relativePath)), true, `Missing built ${relativePath}`);
  for (const relativePath of [
    'styles.css',
    'script.js',
    'tracking.js',
    'assets/hero-abstract.png',
    'assets/creator-placeholder-v1-768.jpg',
    'assets/creator-placeholder-v1-1536.jpg',
  ]) assert.equal(existsSync(path.join(projectRoot, 'dist', 'public', relativePath)), true, `Missing Sites static asset ${relativePath}`);

  const [builtHome, builtScript, builtWorker, packageJson, envExample] = await Promise.all([
    readFile(path.join(projectRoot, 'dist', 'index.html'), 'utf8'),
    readFile(path.join(projectRoot, 'dist', 'script.js'), 'utf8'),
    readFile(path.join(projectRoot, 'dist', 'server', 'index.js'), 'utf8'),
    readFile(path.join(projectRoot, 'package.json'), 'utf8'),
    readFile(path.join(projectRoot, '.env.example'), 'utf8'),
  ]);
  assert.doesNotMatch(`${builtHome}\n${builtScript}\n${builtWorker}\n${packageJson}\n${envExample}`, /clerk|publishable[_-]?key|openSignIn|openSignUp/i);
  assert.doesNotMatch(builtHome, /creator-censored-[12]\.jpg/);
});

test('built CTA links preserve exact destination, safety attributes, and conversion locations', async () => {
  const result = runBuild();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const pages = await Promise.all(['index.html', 'why-follow.html', 'live.html'].map((file) => readFile(path.join(projectRoot, 'dist', file), 'utf8')));
  const anchors = pages.flatMap((page) => [...page.matchAll(/<a\b(?=[^>]*\bdata-referral-link\b)([^>]*)>/g)].map((match) => match[1]));
  assert.ok(anchors.length >= 8);
  for (const attributes of anchors) {
    assert.match(attributes, new RegExp(`href="${canonicalCta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
    assert.match(attributes, /target="_blank"/);
    assert.match(attributes, /rel="noopener noreferrer"/);
    assert.match(attributes, /data-cta-location="[^"]+"/);
  }
});

test('local preview provides anonymous remembered access without identity-provider config', async (t) => {
  const port = 43117;
  const result = runBuild();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const preview = spawn(process.execPath, [path.join(projectRoot, 'scripts', 'serve.mjs')], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port), AGE_POLICY_VERSION: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => preview.kill());

  let output = '';
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Preview did not start.')), 5000);
    preview.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (output.includes('Preview running')) { clearTimeout(timeout); resolve(); }
    });
    preview.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Preview exited early with ${code}.`)); });
  });

  const initial = await fetch(`http://localhost:${port}/api/preview-session`);
  assert.deepEqual(await initial.json(), { ageAttested: false });
  const confirmation = await fetch(`http://localhost:${port}/api/preview-session`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirmed: true }),
  });
  assert.equal(confirmation.status, 204);
  const cookie = confirmation.headers.get('set-cookie').split(';', 1)[0];
  const remembered = await fetch(`http://localhost:${port}/api/preview-session`, { headers: { cookie } });
  assert.deepEqual(await remembered.json(), { ageAttested: true });
  assert.match(output, /anonymous D1 preview sessions/i);
});
