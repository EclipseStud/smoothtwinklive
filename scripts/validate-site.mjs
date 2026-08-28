import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStripchatUrl, liveSources } from '../site-config.mjs';

export const canonicalCta = getStripchatUrl();

const requiredFiles = [
  'index.html', 'styles.css', 'script.js', 'tracking.js',
  'why-follow.html', 'why-follow.js',
  'live.html', 'live.css', 'live.js',
  'site-config.mjs', 'robots.txt', 'sitemap.xml',
  'assets/hero-abstract.png', 'assets/creator-placeholder-v1-768.jpg', 'assets/creator-placeholder-v1-1536.jpg',
  'protected-media/creator-censored-1.jpg', 'protected-media/creator-censored-2.jpg',
  'server/preview-sessions.mjs', 'server/protected-media.mjs', 'server/worker.mjs',
  'db/schema.sql',
  '.openai/drizzle/0001_age_attestations.sql',
  '.openai/drizzle/0002_preview_sessions.sql',
];

function readText(root, relativePath) {
  const filePath = path.join(root, relativePath);
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

export function validateSite(root) {
  const errors = [];
  let checks = 0;
  const check = (condition, message) => {
    checks += 1;
    if (!condition) errors.push(message);
  };

  for (const relativePath of requiredFiles) check(existsSync(path.join(root, relativePath)), `Missing required file: ${relativePath}`);

  const html = readText(root, 'index.html');
  const css = readText(root, 'styles.css');
  const script = readText(root, 'script.js');
  const trackingScript = readText(root, 'tracking.js');
  const whyFollow = readText(root, 'why-follow.html');
  const whyFollowScript = readText(root, 'why-follow.js');
  const liveHtml = readText(root, 'live.html');
  const liveCss = readText(root, 'live.css');
  const liveScript = readText(root, 'live.js');
  const robots = readText(root, 'robots.txt');
  const sitemap = readText(root, 'sitemap.xml');
  const worker = readText(root, 'server/worker.mjs');
  const sessionStore = readText(root, 'server/preview-sessions.mjs');
  const schema = readText(root, 'db/schema.sql');
  const migration = readText(root, '.openai/drizzle/0002_preview_sessions.sql');
  const packageJson = readText(root, 'package.json');
  const envExample = readText(root, '.env.example');

  check(/<html\s+lang=["']en["']/i.test(html), 'Home HTML must declare lang="en".');
  check(/<main\b/i.test(html) && /<h1\b/i.test(html), 'Home page must contain semantic main and h1 landmarks.');
  check(/<meta\s+name=["']description["']/i.test(html), 'Home page must contain a meta description.');
  check(/<meta\s+name=["']robots["'][^>]+index, follow/i.test(html), 'Home page must include index/follow robots metadata.');
  check(/property=["']og:title["']/i.test(html) && /property=["']og:description["']/i.test(html) && /property=["']og:url["']/i.test(html), 'Home page must include complete Open Graph metadata.');
  check(/name=["']twitter:card["']/i.test(html) && /name=["']twitter:title["']/i.test(html), 'Home page must include X Card metadata.');
  check(html.includes('https://smoothtwinklive.com/') && !html.includes('eclipsestudmodeling.com'), 'Home metadata must use only smoothtwinklive.com.');
  check(/<script\s+type=["']application\/ld\+json["']>[\s\S]*"@type": "WebSite"/i.test(html), 'Home page must include WebSite structured data.');
  check(!/href=["'][^"']*stripchat\.com/i.test(html), `Raw CTA links must resolve only through site-config.mjs as ${canonicalCta}.`);
  check((html.match(/data-referral-link/g) || []).length >= 5, 'Home page must include at least five referral CTA locations.');
  check(['hero', 'preview_mid', 'lower', 'final', 'sticky_mobile'].every((location) => html.includes(`data-cta-location="${location}"`)), 'Home page must include every conversion CTA location.');
  check(['WATCH ME', 'LIVE ON', 'STRIPCHAT.'].every((line) => html.includes(`class="headline-line">${line}`) || html.includes(`class="headline-line accent-line">${line}`)), 'Hero headline must use intentional non-breaking lines.');
  check(['18+ ONLY', 'LIVE CREATOR', 'DIRECT PROFILE', 'PREVIEW AVAILABLE'].every((label) => html.includes(label)), 'Home page must include the four-item trust strip.');
  check((html.match(/class="benefit-card/g) || []).length >= 4, 'Home page must include at least four visual benefit cards.');
  check(html.includes('href="/why-follow"') && !/href="#benefits"[^>]*>WHY FOLLOW/i.test(html), 'WHY FOLLOW must open the dedicated page.');
  check(html.includes("I'M 18+ — SHOW PREVIEWS") && html.includes('data-preview-confirm'), 'Preview access must use the one-click 18+ button.');
  check((html.match(/data-protected-media/g) || []).length >= 2, 'Home page must declare both private preview slots.');
  check(html.includes('/assets/creator-placeholder-v1-1536.jpg') && html.includes('srcset=') && ['hero', 'left', 'right', 'detail'].every((crop) => html.includes(`data-placeholder-crop="${crop}"`)), 'Public placeholder must provide responsive hero and gallery crops.');
  check(!/src=["'][^"']*creator-censored/i.test(html), 'Protected creator media cannot use public image sources.');
  check(!/\bLOCKED\b|\bUNLOCK\w*\b|CENSORED PUBLIC PREVIEW|SIGN IN|CREATE ACCOUNT|CLERK/i.test(html), 'Home page cannot use account-wall language.');
  check(!/viewer(?:s| count)?|countdown|limited[- ]time|LIVE NOW/i.test(html), 'Home page cannot fabricate urgency or live status.');
  check((html.match(/<details\b/g) || []).length >= 5, 'Home page must include at least five FAQ items.');
  check(/payment/i.test(html) && /region/i.test(html) && /sessionStorage/.test(html) && /keyboard/i.test(html) && /reduced motion/i.test(html), 'FAQ must cover payment, regional access, privacy, and accessibility.');
  check(!/<(?:audio|video)\b[^>]*\bautoplay\b/i.test(html), 'Autoplay media is not allowed.');

  check(css.includes(':focus-visible'), 'CSS must include visible focus states.');
  check(css.includes('prefers-reduced-motion'), 'CSS must respect reduced-motion preferences.');
  check(css.includes('safe-area-inset-bottom'), 'Mobile CTA must respect bottom safe areas.');
  check(css.includes('@media (max-width: 22rem)'), 'CSS must include narrow 320px behavior.');
  check(/min-height:\s*5[4-9]px/.test(css), 'Primary controls must provide large touch targets.');
  check(script.includes('new Date().getFullYear()'), 'Home footer year must be generated at runtime.');
  check(script.includes("fetch('/api/preview-session'") && script.includes('/api/media/'), 'Home script must use anonymous preview APIs.');
  check(!/clerk|openSignIn|openSignUp/i.test(`${html}\n${script}`), 'Home UI and browser runtime must not include identity-provider code.');

  check(/<html\s+lang=["']en["']/i.test(whyFollow) && /<main\b/i.test(whyFollow) && /<h1\b/i.test(whyFollow), 'WHY FOLLOW page must have accessible document landmarks.');
  check(whyFollow.includes('https://smoothtwinklive.com/why-follow'), 'WHY FOLLOW metadata must use its canonical URL.');
  check(whyFollow.includes('WHY FOLLOW') && whyFollow.includes('SMOOTHTWINKVIBES'), 'WHY FOLLOW page must state its purpose and creator.');
  check((whyFollow.match(/data-referral-link/g) || []).length >= 2, 'WHY FOLLOW page must include top and final referral CTAs.');
  check(whyFollow.includes('href="/"') && whyFollow.includes('href="/#preview"') && whyFollow.includes('href="/#faq"'), 'WHY FOLLOW page must link to home, preview, and FAQ.');
  check(whyFollowScript.includes('why_follow_page_view') && whyFollowScript.includes('stripchat_cta_click'), 'WHY FOLLOW tracking must record page and CTA events.');

  check(/<main\b/i.test(liveHtml) && /<h1\b/i.test(liveHtml), 'Live page must contain semantic main and h1 landmarks.');
  check(liveHtml.includes('SMOOTHTWINKVIBES') && liveHtml.includes('WATCH ME LIVE') && !/ECLIPSESTUD/i.test(liveHtml), 'Live page must use SmoothTwinkVibes branding.');
  check(liveHtml.includes('{{STRIPCHAT_REFERRAL_URL}}'), 'Live CTA must use the centralized referral placeholder.');
  check(/target="_blank"/i.test(liveHtml) && /rel="noopener noreferrer"/i.test(liveHtml), 'Live CTA must protect external navigation.');
  check(liveHtml.includes('href="/why-follow"') && liveHtml.includes('href="/#faq"'), 'Live page must link to WHY FOLLOW and FAQ.');
  check(liveHtml.includes('https://smoothtwinklive.com/live') && !liveHtml.includes('eclipsestudmodeling.com'), 'Live metadata must use only smoothtwinklive.com.');
  check(/<script\s+type=["']application\/ld\+json["']>[\s\S]*"@type": "WebPage"/i.test(liveHtml), 'Live page must include WebPage structured data.');
  check(liveCss.includes(':focus-visible') && liveCss.includes('prefers-reduced-motion'), 'Live styles must preserve focus and reduced-motion support.');
  check(liveScript.includes("record('live_page_view')") && liveScript.includes("record('stripchat_cta_click'"), 'Live tracking must record views and CTA clicks.');

  check(trackingScript.includes('sessionStorage'), 'Tracking must stay first-party and session-scoped.');
  check(trackingScript.includes('URLSearchParams') && trackingScript.includes('utm_campaign'), 'Tracking must preserve approved UTM attribution locally.');
  check(!/fetch\s*\(|XMLHttpRequest|navigator\.sendBeacon/.test(trackingScript), 'Tracking cannot send events to an external endpoint.');
  check(liveSources.every((source) => trackingScript.includes(`'${source}'`)), 'Tracking must support every configured source route.');
  check(robots.includes('Sitemap: https://smoothtwinklive.com/sitemap.xml'), 'robots.txt must advertise the canonical sitemap.');
  check(['https://smoothtwinklive.com/', 'https://smoothtwinklive.com/live', 'https://smoothtwinklive.com/why-follow'].every((url) => sitemap.includes(`<loc>${url}</loc>`)), 'Sitemap must list all three public canonical pages.');
  check(!/api\/|protected-media|creator-censored/i.test(sitemap), 'Sitemap cannot expose private routes or media.');

  check(worker.includes("'Strict-Transport-Security': 'max-age=31536000'") && worker.includes('status: 308'), 'Worker must redirect HTTP and advertise one-year HSTS.');
  check(worker.includes("'/api/preview-session'") && worker.includes("'/api/access-status'") && worker.includes("'/api/age-attestation'"), 'Worker must expose the new API and legacy anonymous aliases.');
  check(sessionStore.includes('crypto.getRandomValues') && sessionStore.includes("crypto.subtle.digest('SHA-256'"), 'Preview sessions must use CSPRNG tokens and SHA-256 storage keys.');
  check(sessionStore.includes('HttpOnly; Secure; SameSite=Lax') && sessionStore.includes('Max-Age=${PREVIEW_SESSION_SECONDS}'), 'Preview cookie must be HttpOnly, Secure, SameSite=Lax, and age limited.');
  check(schema.includes('preview_sessions') && migration.includes('preview_sessions') && migration.includes('expires_at'), 'Active schema and migration must define expiring preview sessions.');
  check(!/clerk/i.test(`${worker}\n${sessionStore}\n${schema}\n${packageJson}\n${envExample}`), 'Runtime, active schema, dependencies, and env example must not include identity-provider configuration.');

  const placeholderPath = path.join(root, 'assets/creator-placeholder-v1-1536.jpg');
  const compactPlaceholderPath = path.join(root, 'assets/creator-placeholder-v1-768.jpg');
  check(existsSync(placeholderPath) && statSync(placeholderPath).size > 100_000, 'Public creator placeholder must be a real generated image asset.');
  check(existsSync(compactPlaceholderPath) && statSync(compactPlaceholderPath).size < statSync(placeholderPath).size, 'Public placeholder must include a smaller responsive derivative.');
  for (const relativePath of ['protected-media/creator-censored-1.jpg', 'protected-media/creator-censored-2.jpg']) {
    const filePath = path.join(root, relativePath);
    check(existsSync(filePath) && statSync(filePath).size > 0, `Protected media must remain present and private: ${relativePath}`);
  }

  return { checks, errors };
}

function rootFromArgs(args) {
  const rootIndex = args.indexOf('--root');
  return rootIndex >= 0 && args[rootIndex + 1] ? path.resolve(args[rootIndex + 1]) : process.cwd();
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  const result = validateSite(rootFromArgs(process.argv.slice(2)));
  if (result.errors.length > 0) {
    console.error(`Build validation failed (${result.errors.length} issue${result.errors.length === 1 ? '' : 's'}):`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`Validation passed: ${result.checks} checks.`);
  }
}
