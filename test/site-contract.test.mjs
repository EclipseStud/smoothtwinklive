import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { getStripchatUrl } from '../site-config.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const validator = path.join(projectRoot, 'scripts', 'validate-site.mjs');
const canonicalCta = getStripchatUrl();

function runValidator(root = projectRoot) {
  return spawnSync(process.execPath, [validator, '--root', root], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
}

test('approved Editorial Bento landing page passes its production contract', () => {
  const result = runValidator();

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Validation passed:/);
});

test('live funnel has central referral config, source routes, metadata, and event tracking', async () => {
  const [home, live, config, liveScript, trackingScript] = await Promise.all([
    readFile(path.join(projectRoot, 'index.html'), 'utf8'),
    readFile(path.join(projectRoot, 'live.html'), 'utf8'),
    readFile(path.join(projectRoot, 'site-config.mjs'), 'utf8'),
    readFile(path.join(projectRoot, 'live.js'), 'utf8'),
    readFile(path.join(projectRoot, 'tracking.js'), 'utf8'),
  ]);

  assert.match(config, /STRIPCHAT_USER_ID = 'SmoothTwinkVibes'/);
  assert.match(config, /getStripchatUrl/);
  assert.match(home, /data-referral-link/);
  assert.match(home, /ECLIPSESTUD/);
  assert.match(home, /ENTER MY LIVE ROOM/);
  assert.match(live, /WATCH ECLIPSESTUD LIVE/);
  assert.match(live, /EclipseStud — Watch Me Live/);
  assert.match(live, /href="\/live\.css"/);
  assert.match(live, /src="\/live\.js"/);
  assert.match(trackingScript, /sessionStorage/);
  assert.match(liveScript, /live_page_view/);
  assert.match(liveScript, /stripchat_cta_click/);
  assert.match(liveScript, /mood_selection/);
});

test('validator rejects a CTA destination that drifts from the canonical URL', async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'stripchat-referral-contract-'));

  try {
    await mkdir(path.join(fixture, 'assets'));
    await writeFile(
      path.join(fixture, 'index.html'),
      `<!doctype html><html lang="en"><head><meta name="description" content="Test."><meta property="og:image" content="./og-preview.svg"></head><body><main><h1>Test</h1><a href="https://stripchat.com/wrong">Meet SmoothTwinkVibes</a></main></body></html>`,
    );
    await writeFile(path.join(fixture, 'styles.css'), ':focus-visible { outline: 3px solid white; } @media (prefers-reduced-motion: reduce) { * { animation: none; } } .button { min-height: 44px; }');
    await writeFile(path.join(fixture, 'script.js'), 'document.documentElement.dataset.ready = "true";');
    await writeFile(path.join(fixture, 'og-preview.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    await writeFile(path.join(fixture, 'assets', 'hero-abstract.png'), Buffer.from([1]));

    const result = runValidator(fixture);

    assert.notEqual(result.status, 0, 'A non-canonical CTA must fail validation.');
    assert.match(result.stderr, new RegExp(canonicalCta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  } finally {
    await rm(fixture, { force: true, recursive: true });
  }
});

test('production build keeps protected creator media out of public static output', async () => {
  const result = spawnSync(process.execPath, [path.join(projectRoot, 'scripts', 'build.mjs')], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(existsSync(path.join(projectRoot, 'dist', 'assets', 'creator-censored-1.jpg')), false);
  assert.equal(existsSync(path.join(projectRoot, 'dist', 'assets', 'creator-censored-2.jpg')), false);
  assert.equal(existsSync(path.join(projectRoot, 'dist', 'protected-media')), false);
  const builtHome = await readFile(path.join(projectRoot, 'dist', 'index.html'), 'utf8');
  assert.doesNotMatch(builtHome, /creator-censored-[12]\.jpg/);
  const builtWorker = await readFile(path.join(projectRoot, 'dist', 'server', 'index.js'), 'utf8');
  assert.doesNotMatch(builtWorker, /LOCAL_AUTH_TEST_MODE|local-test-token/);

  const previewServer = await readFile(path.join(projectRoot, 'scripts', 'serve.mjs'), 'utf8');
  assert.match(previewServer, /const publicFiles = new Set/);
  assert.match(previewServer, /if \(!publicFiles\.has\(relativePath\)\)/);
});
