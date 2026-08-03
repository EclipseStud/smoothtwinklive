import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const canonicalCta = 'https://stripchat.com/SmoothTwinkVibes/follow-me';

const requiredFiles = [
  'index.html',
  'styles.css',
  'script.js',
  'robots.txt',
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

  check(/<html\s+lang=["']en["']/i.test(html), 'HTML must declare lang="en".');
  check(/<main\b/i.test(html), 'HTML must contain a semantic <main> landmark.');
  check(/<h1\b/i.test(html), 'HTML must contain one primary page heading.');
  check(/<meta\s+name=["']description["']/i.test(html), 'HTML must contain a meta description.');
  check(/property=["']og:image["']/i.test(html), 'HTML must declare an Open Graph image.');

  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1]);
  const referralHrefs = hrefs.filter((href) => href.includes('stripchat.com'));
  check(
    referralHrefs.length >= 4,
    `Expected at least four canonical CTA links to ${canonicalCta}; found ${referralHrefs.length}.`,
  );
  check(
    referralHrefs.every((href) => href === canonicalCta),
    `Every StripChat CTA must use exactly ${canonicalCta}.`,
  );
  check(html.includes('Follow SmoothTwinkVibes'), 'Hero CTA label must name SmoothTwinkVibes.');
  check(html.includes('Curated.') && html.includes('Unfiltered.'), 'Page must include the approved editorial hero.');
  check(html.includes('class="hero-bento"'), 'Page must include the approved bento hero layout.');
  check(html.includes('Common queries'), 'Page must include the approved FAQ heading.');
  check(!/<(?:audio|video)\b[^>]*\bautoplay\b/i.test(html), 'Autoplay media is not allowed.');
  check(
    !/\b(official|verified|secure|guaranteed)\b/i.test(html),
    'Avoid unsupported verification, security, or guarantee claims.',
  );

  check(css.includes(':focus-visible'), 'CSS must include a visible focus state.');
  check(css.includes('prefers-reduced-motion'), 'CSS must respect reduced-motion preferences.');
  check(css.includes('min-height: 44px'), 'CSS must provide 44px interactive targets.');
  check(script.includes('new Date().getFullYear()'), 'Footer year must be generated at runtime.');
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
