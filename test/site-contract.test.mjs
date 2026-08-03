import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const validator = path.join(projectRoot, 'scripts', 'validate-site.mjs');
const canonicalCta = 'https://stripchat.com/SmoothTwinkVibes/follow-me';

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

test('validator rejects a CTA destination that drifts from the canonical URL', async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'stripchat-referral-contract-'));

  try {
    await mkdir(path.join(fixture, 'assets'));
    await writeFile(
      path.join(fixture, 'index.html'),
      `<!doctype html><html lang="en"><head><meta name="description" content="Test."><meta property="og:image" content="./og-preview.svg"></head><body><main><h1>Test</h1><a href="https://example.com/wrong">Meet SmoothTwinkVibes</a></main></body></html>`,
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
