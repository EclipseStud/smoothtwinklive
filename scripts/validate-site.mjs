import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStripchatUrl, liveSources } from '../site-config.mjs';

export const canonicalCta = getStripchatUrl();

const requiredFiles = [
  'index.html',
  'styles.css',
  'script.js',
  'tracking.js',
  'live.html',
  'live.css',
  'live.js',
  'site-config.mjs',
  'robots.txt',
  'assets/hero-abstract.png',
  'protected-media/creator-censored-1.jpg',
  'protected-media/creator-censored-2.jpg',
  'server/auth.mjs',
  'server/age-attestations.mjs',
  'server/protected-media.mjs',
  'server/worker.mjs',
  'db/schema.sql',
  '.openai/drizzle/0001_age_attestations.sql',
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

  for (const relativePath of requiredFiles) {
    check(existsSync(path.join(root, relativePath)), `Missing required file: ${relativePath}`);
  }

  const html = readText(root, 'index.html');
  const css = readText(root, 'styles.css');
  const script = readText(root, 'script.js');
  const trackingScript = readText(root, 'tracking.js');
  const liveHtml = readText(root, 'live.html');
  const liveCss = readText(root, 'live.css');
  const liveScript = readText(root, 'live.js');

  check(/<html\s+lang=["']en["']/i.test(html), 'HTML must declare lang="en".');
  check(/<main\b/i.test(html), 'HTML must contain a semantic <main> landmark.');
  check(/<h1\b/i.test(html), 'HTML must contain one primary page heading.');
  check(/<meta\s+name=["']description["']/i.test(html), 'HTML must contain a meta description.');
  check(/property=["']og:image["']/i.test(html), 'HTML must declare an Open Graph image.');

  const referralHrefs = [...html.matchAll(/href=["']([^"']*stripchat\.com[^"']*)["']/gi)].map((match) => match[1]);
  check(
    referralHrefs.length === 0,
    `Referral links must be defined only in site-config.mjs as ${canonicalCta}.`,
  );
  check(
    (html.match(/data-referral-link/g) || []).length >= 4,
    'Expected at least four root CTA links using data-referral-link.',
  );
  check(html.includes('ECLIPSESTUD') && html.includes('YOU FOUND ME.'), 'Home page must include EclipseStud cinematic hero copy.');
  check(html.includes('ENTER MY LIVE ROOM'), 'Home page must include its primary live-room CTA.');
  check(html.includes('A LITTLE PREVIEW') && html.includes('INTERACTIVE MOOD'), 'Home page must include preview and mood sections.');
  check(html.includes('data-account-gate') && html.includes('data-age-confirmation'), 'Home page must include Clerk account and explicit 18+ controls.');
  check((html.match(/data-protected-media/g) || []).length >= 2, 'Home page must declare protected media placeholders.');
  check(!/src=["'][^"']*creator-censored/i.test(html), 'Protected creator media cannot use public image sources.');
  check(html.includes('{{CLERK_PUBLISHABLE_KEY}}'), 'Home page must use runtime Clerk publishable-key injection.');
  check(!/<(?:audio|video)\b[^>]*\bautoplay\b/i.test(html), 'Autoplay media is not allowed.');
  check(
    !/\b(official|verified|secure|guaranteed)\b/i.test(html),
    'Avoid unsupported verification, security, or guarantee claims.',
  );

  check(css.includes(':focus-visible'), 'CSS must include a visible focus state.');
  check(css.includes('prefers-reduced-motion'), 'CSS must respect reduced-motion preferences.');
  check(css.includes('min-height:52px'), 'CSS must provide at least 44px interactive targets.');
  check(script.includes('new Date().getFullYear()'), 'Footer year must be generated at runtime.');
  check(liveHtml.includes('WATCH ECLIPSESTUD LIVE'), 'Live page must include its primary EclipseStud live CTA.');
  check(/<main\b/i.test(liveHtml), 'Live page must contain a semantic <main> landmark.');
  check(/<h1\b/i.test(liveHtml), 'Live page must contain one primary page heading.');
  check(liveHtml.includes('18+'), 'Live page must include an 18+ notice.');
  check(liveHtml.includes('{{STRIPCHAT_REFERRAL_URL}}'), 'Live CTA must use the centralized referral placeholder.');
  check(/target="_blank"/i.test(liveHtml) && /rel="noopener noreferrer"/i.test(liveHtml), 'Live CTA must protect external navigation.');
  check(/<meta\s+name="description"/i.test(liveHtml), 'Live page must include a meta description.');
  check(/property="og:title"/i.test(liveHtml) && /property="og:description"/i.test(liveHtml), 'Live page must include Open Graph metadata.');
  check(!/<(?:audio|video)\b[^>]*\bautoplay\b/i.test(liveHtml), 'Live page cannot autoplay media.');
  check(liveCss.includes(':focus-visible'), 'Live CSS must include a visible focus state.');
  check(liveCss.includes('min-height: 56px'), 'Live CSS must provide a large CTA target.');
  check(trackingScript.includes('sessionStorage'), 'Tracking must stay first-party and session-scoped.');
  check(liveScript.includes("record('live_page_view')") && liveScript.includes("record('stripchat_cta_click'"), 'Live tracking must record views and CTA clicks.');
  check(liveSources.every((source) => trackingScript.includes(`'${source}'`)), 'Tracking must support every configured traffic source.');
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
