import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
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
  assert.match(live, /<title>SmoothTwinkVibes: A Curated Adults-Only Experience<\/title>/);
  assert.match(live, /href="\/live\.css"/);
  assert.match(live, /src="\/live\.js"/);
  assert.match(trackingScript, /sessionStorage/);
  assert.match(liveScript, /live_page_view/);
  assert.match(liveScript, /stripchat_cta_click/);
  assert.match(liveScript, /mood_selection/);
});

test('crawl metadata and content-depth improvements stay complete and factual', async () => {
  const [home, live] = await Promise.all([
    readFile(path.join(projectRoot, 'index.html'), 'utf8'),
    readFile(path.join(projectRoot, 'live.html'), 'utf8'),
  ]);
  const enhancedDescription = 'Explore SmoothTwinkVibes: a curated, adults-only creator experience with cinematic previews, direct StripChat access, and clear privacy guidance.';
  const socialDescription = 'Explore curated, adults-only SmoothTwinkVibes on StripChat for a direct and cinematic creator experience.';

  for (const page of [home, live]) {
    assert.match(page, /<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" \/>/);
    assert.match(page, /<link rel="icon" type="image\/png" href="\/assets\/hero-abstract\.png" \/>/);
    assert.ok(page.includes(`<meta name="description" content="${enhancedDescription}" />`));
    assert.ok(page.includes('<meta property="og:title" content="SmoothTwinkVibes: A Curated Adults-Only Experience" />'));
    assert.ok(page.includes(`<meta property="og:description" content="${socialDescription}" />`));
    assert.ok(page.includes('<meta property="og:image" content="https://smoothtwinklive.com/assets/hero-abstract.png" />'));
    assert.ok(page.includes('<meta name="twitter:card" content="summary_large_image" />'));
    assert.ok(page.includes('<meta name="twitter:title" content="SmoothTwinkVibes: A Curated Adults-Only Experience" />'));
    assert.ok(page.includes(`<meta name="twitter:description" content="${socialDescription}" />`));
  }

  assert.match(home, /href="#preview"[^>]*>PREVIEW THE VIBE/);
  assert.match(home, /PREVIEW THE MOOD/);
  assert.match(home, /OPEN THE PROFILE/);
  assert.match(home, /CHOOSE YOUR PACE/);
  assert.ok((home.match(/<details\b/g) || []).length >= 5, 'Expected at least five expandable FAQ items.');
  assert.match(home, /payment/i);
  assert.match(home, /region/i);
  assert.match(home, /sessionStorage/);
  assert.match(home, /keyboard/i);
  assert.match(home, /reduced motion/i);
  assert.match(home, /Retry/);
  assert.match(home, /StripChat presents available account and purchase options after you arrive\./);
  assert.doesNotMatch(home, /exclusive clips|early access|live Q&As?|limited-time|new post weekly/i);
  assert.doesNotMatch(home, /free tokens|token discount|guaranteed signup/i);
});

test('public search surface has one canonical domain, structured data, and a sitemap', async () => {
  const [home, live, robots, sitemap] = await Promise.all([
    readFile(path.join(projectRoot, 'index.html'), 'utf8'),
    readFile(path.join(projectRoot, 'live.html'), 'utf8'),
    readFile(path.join(projectRoot, 'robots.txt'), 'utf8'),
    readFile(path.join(projectRoot, 'sitemap.xml'), 'utf8'),
  ]);
  const origin = 'https://smoothtwinklive.com';

  for (const [page, pathname] of [[home, '/'], [live, '/live']]) {
    assert.ok(page.includes(`<link rel="canonical" href="${origin}${pathname}" />`));
    assert.ok(page.includes(`<meta property="og:url" content="${origin}${pathname}" />`));
    assert.match(page, /<script type="application\/ld\+json">[\s\S]*"@context": "https:\/\/schema\.org"/);
    assert.doesNotMatch(page, /eclipsestudmodeling\.com/i);
  }

  assert.match(home, /"@type": "WebSite"/);
  assert.match(live, /"@type": "WebPage"/);
  assert.match(robots, new RegExp(`Sitemap: ${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/sitemap\\.xml`));
  assert.match(sitemap, /<loc>https:\/\/smoothtwinklive\.com\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/smoothtwinklive\.com\/live<\/loc>/);
  assert.doesNotMatch(sitemap, /api\/|protected-media|creator-censored/i);
});

test('tracking preserves approved UTM attribution without sending it off-site', async () => {
  const trackingScript = await readFile(path.join(projectRoot, 'tracking.js'), 'utf8');

  assert.match(trackingScript, /URLSearchParams/);
  assert.match(trackingScript, /utm_source/);
  assert.match(trackingScript, /utm_medium/);
  assert.match(trackingScript, /utm_campaign/);
  assert.match(trackingScript, /utmContext/);
  assert.match(trackingScript, /sessionStorage/);
  assert.doesNotMatch(trackingScript, /fetch\s*\(|XMLHttpRequest|navigator\.sendBeacon/);
});

test('internal navigation uses descriptive links to real on-site sections', async () => {
  const [home, live] = await Promise.all([
    readFile(path.join(projectRoot, 'index.html'), 'utf8'),
    readFile(path.join(projectRoot, 'live.html'), 'utf8'),
  ]);

  for (const sectionId of ['about', 'preview', 'benefits', 'faq']) {
    assert.ok(home.includes(`id="${sectionId}"`), `Missing internal destination #${sectionId}.`);
  }
  assert.match(home, /<nav aria-label="Primary navigation">[^<]*(?:<a[^>]+>[^<]+<\/a>){5}<\/nav>/);
  assert.match(home, /href="#about">review the three-step journey<\/a>/i);
  assert.match(home, /href="#benefits">see why following may fit<\/a>/i);
  assert.match(home, /class="supporting-links"[^>]*>[\s\S]*href="#preview"[\s\S]*href="#faq"/);
  assert.match(home, /<nav class="footer-nav"[^>]+>[\s\S]*href="#about"[\s\S]*href="#benefits"[\s\S]*href="#faq"[\s\S]*href="\/live"/);
  assert.match(live, /<nav class="live-links"[^>]+>[\s\S]*href="\/#about"[\s\S]*href="\/#preview"[\s\S]*href="\/#benefits"[\s\S]*href="\/#faq"/);
  assert.doesNotMatch(`${home}\n${live}`, /href="\/(?:creators|privacy|terms|vibe|why-follow|external-stripchat-hub)(?:[\/#"])/i);
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

test('production build exposes separate Clerk sign-in and sign-up actions', async () => {
  const result = spawnSync(process.execPath, [path.join(projectRoot, 'scripts', 'build.mjs')], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const builtHome = await readFile(path.join(projectRoot, 'dist', 'index.html'), 'utf8');
  const builtScript = await readFile(path.join(projectRoot, 'dist', 'script.js'), 'utf8');

  assert.match(builtHome, /data-clerk-sign-in/);
  assert.match(builtHome, /data-clerk-sign-up/);
  assert.match(builtScript, /ui\.browser\.js/);
  assert.match(builtScript, /__internal_ClerkUICtor/);
  assert.match(builtScript, /openSignIn/);
  assert.match(builtScript, /openSignUp/);
});

test('local preview injects Clerk configuration from process environment', async (t) => {
  const port = 43117;
  const result = spawnSync(process.execPath, [path.join(projectRoot, 'scripts', 'build.mjs')], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const preview = spawn(process.execPath, [path.join(projectRoot, 'scripts', 'serve.mjs')], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      CLERK_PUBLISHABLE_KEY: 'pk_test_preview_contract',
      CLERK_SECRET_KEY: 'sk_test_preview_contract',
      CLERK_AUTHORIZED_PARTIES: `http://localhost:${port}`,
      AGE_POLICY_VERSION: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => preview.kill());

  let previewOutput = '';
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Preview did not start.')), 5000);
    preview.stdout.on('data', (chunk) => {
      previewOutput += chunk.toString();
      if (previewOutput.includes('Preview running')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    preview.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Preview exited early with ${code}.`));
    });
  });

  const response = await fetch(`http://localhost:${port}/`);
  const home = await response.text();
  assert.equal(response.status, 200);
  assert.match(previewOutput, /Clerk-backed local APIs/);
  assert.match(home, /pk_test_preview_contract/);
  assert.doesNotMatch(home, /\{\{CLERK_PUBLISHABLE_KEY\}\}/);
});
