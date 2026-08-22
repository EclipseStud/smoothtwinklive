# Clerk Age-Gated Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect both censored creator images behind Clerk sign-in and one-time account-bound 18+ self-attestation while preserving the public EclipseStud referral funnel.

**Architecture:** Public pages render abstract placeholders. A Cloudflare Worker verifies Clerk session tokens, stores attestation state in D1, and returns allowlisted image bytes from private R2 only after authorization. Initial private R2 objects are seeded from server-bundled censored derivatives on the first authorized request, so protected bytes never enter public static output.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, `@clerk/clerk-js`, `@clerk/backend`, esbuild, Cloudflare Workers, D1, R2, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-21-clerk-age-gated-media-design.md`

## Global Constraints

- Preserve `https://stripchat.com/SmoothTwinkVibes/follow-me` through `getStripchatUrl()`.
- Keep `/live`, `/live/x`, `/live/reddit`, `/live/bluesky`, `/live/ad`, and `/live/direct` public.
- Treat 18+ status as self-attestation, never verified age.
- Never expose `CLERK_SECRET_KEY` to source-controlled config, browser code, static output, logs, or test output.
- Accept only Clerk session tokens and enforce centralized `authorizedParties`.
- Keep protected JPGs out of `dist/assets` and every public static-file list.
- Fail closed for Clerk, D1, or R2 errors.
- Commit only after complete proof; then publish the exact proven commit.
- Preserve unrelated dirty files and exclude `.codex/`, `.superdesign/`, `tmp/`, `.env`, and local logs from commit.

## File Structure

- Create `server/auth.mjs`: Clerk request authentication and origin allowlist parsing.
- Create `server/age-attestations.mjs`: D1 attestation reads/writes.
- Create `server/protected-media.mjs`: media ID allowlist, private R2 lookup, authorized seeding, response headers.
- Create `server/worker.mjs`: public routes and protected API orchestration.
- Create `server/generated-content.mjs`: ignored build-generated pages and private media payloads.
- Create `db/schema.sql`: source-of-truth D1 schema.
- Create `.openai/drizzle/0001_age_attestations.sql`: deployable migration.
- Create `.env.example`: safe public names and empty secret field.
- Create `test/auth-and-media.test.mjs`: auth, attestation, media, and fail-closed tests.
- Modify `index.html`: abstract placeholders and accessible Clerk/age-gate controls.
- Modify `script.js`: Clerk UI state, attestation request, protected image loading, object URL cleanup, privacy-safe analytics.
- Modify `styles.css`: account gate, placeholder, error, and responsive states.
- Modify `scripts/build.mjs`: bundle browser/Worker code, generate server-only content, exclude protected media from public output.
- Modify `scripts/serve.mjs`: invoke built Worker with local fake bindings for route-level proof.
- Modify `scripts/validate-site.mjs`: validate protected-media and Clerk contracts.
- Modify `test/site-contract.test.mjs`: preserve referral contracts and assert no public creator assets.
- Modify `.openai/hosting.json`: declare `DB` and `MEDIA` bindings.
- Modify `.gitignore`: ignore secrets, generated server content, temp media, and QA artifacts.
- Move censored JPGs from `assets/` to `protected-media/`.

---

### Task 1: Lock Security Contracts With Failing Tests

**Files:**
- Create: `test/auth-and-media.test.mjs`
- Modify: `test/site-contract.test.mjs`
- Test: `test/auth-and-media.test.mjs`

**Interfaces:**
- Consumes: existing `getStripchatUrl()` and source route contract.
- Produces: required exports `authenticateClerkRequest`, `hasCurrentAttestation`, `recordAttestation`, `getProtectedMedia`, and `createWorker`.

- [ ] **Step 1: Add failing public-output contract**

Add assertions after running the build:

```js
assert.equal(existsSync(path.join(projectRoot, 'dist', 'assets', 'creator-censored-1.jpg')), false);
assert.equal(existsSync(path.join(projectRoot, 'dist', 'assets', 'creator-censored-2.jpg')), false);
assert.doesNotMatch(await readFile(path.join(projectRoot, 'dist', 'index.html'), 'utf8'), /creator-censored-[12]\.jpg/);
```

- [ ] **Step 2: Add failing Worker authorization tests**

Create fixtures with fake Clerk auth, D1, and R2 bindings. Assert:

```js
assert.equal((await worker.fetch(new Request('https://site.test/api/media/creator-1'), env)).status, 401);
assert.equal((await authorizedButUnattested.fetch(mediaRequest, env)).status, 403);
assert.equal((await attestedWorker.fetch(mediaRequest, env)).status, 200);
assert.deepEqual(new Uint8Array(await response.arrayBuffer()), expectedJpegBytes);
```

Also assert invalid token `401`, unknown ID `404`, false confirmation `400`, first/repeated confirmation `204`, policy mismatch `403`, Clerk failure `503`, D1 failure `503`, R2 failure `503`, `Cache-Control: private, no-store`, `Vary: Authorization, Cookie`, and `X-Content-Type-Options: nosniff`.

- [ ] **Step 3: Run focused tests and confirm RED**

Run: `node --test test/auth-and-media.test.mjs test/site-contract.test.mjs`

Expected: FAIL because server modules and protected-output rules do not exist.

### Task 2: Add Clerk Authentication Boundary

**Files:**
- Create: `server/auth.mjs`
- Create: `.env.example`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `test/auth-and-media.test.mjs`

**Interfaces:**
- Produces: `parseAuthorizedParties(value: string): string[]` and `authenticateClerkRequest(request: Request, env: Env, createClient?: Function): Promise<{ok: true, userId: string} | {ok: false, status: 401 | 503}>`.

- [ ] **Step 1: Install pinned current dependencies**

Run: `npm install @clerk/backend @clerk/clerk-js`

Run: `npm install --save-dev esbuild`

- [ ] **Step 2: Implement centralized auth wrapper**

Core behavior:

```js
const client = createClient({
  publishableKey: env.CLERK_PUBLISHABLE_KEY,
  secretKey: env.CLERK_SECRET_KEY,
});
const state = await client.authenticateRequest(request, {
  acceptsToken: 'session_token',
  authorizedParties: parseAuthorizedParties(env.CLERK_AUTHORIZED_PARTIES),
});
if (!state.isAuthenticated) return { ok: false, status: 401 };
const { userId } = state.toAuth();
return userId ? { ok: true, userId } : { ok: false, status: 401 };
```

Return `503` when required configuration is absent or Clerk throws. Never include exception text or tokens in responses.

- [ ] **Step 3: Add safe config template**

```ini
CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_AUTHORIZED_PARTIES=http://localhost:4173,https://smoothtwinklive.com
AGE_POLICY_VERSION=1
```

- [ ] **Step 4: Run auth-focused tests and confirm GREEN**

Run: `node --test --test-name-pattern="Clerk|token|authorized" test/auth-and-media.test.mjs`

Expected: PASS.

### Task 3: Add D1 Attestation Store

**Files:**
- Create: `server/age-attestations.mjs`
- Create: `db/schema.sql`
- Create: `.openai/drizzle/0001_age_attestations.sql`
- Modify: `.openai/hosting.json`
- Test: `test/auth-and-media.test.mjs`

**Interfaces:**
- Produces: `hasCurrentAttestation(db, userId, policyVersion): Promise<boolean>` and `recordAttestation(db, userId, policyVersion, now?: Date): Promise<void>`.

- [ ] **Step 1: Add exact schema and migration**

```sql
CREATE TABLE IF NOT EXISTS age_attestations (
  clerk_user_id TEXT PRIMARY KEY NOT NULL,
  attested_at TEXT NOT NULL,
  policy_version TEXT NOT NULL
);
```

- [ ] **Step 2: Implement prepared D1 queries**

Read:

```sql
SELECT 1 AS allowed
FROM age_attestations
WHERE clerk_user_id = ? AND policy_version = ?
LIMIT 1
```

Write:

```sql
INSERT INTO age_attestations (clerk_user_id, attested_at, policy_version)
VALUES (?, ?, ?)
ON CONFLICT(clerk_user_id) DO UPDATE SET
  attested_at = excluded.attested_at,
  policy_version = excluded.policy_version
```

- [ ] **Step 3: Declare Sites bindings**

Set `.openai/hosting.json` to logical D1 binding `DB` and R2 binding `MEDIA` while preserving existing `project_id`.

- [ ] **Step 4: Run attestation-focused tests and confirm GREEN**

Run: `node --test --test-name-pattern="attestation|policy" test/auth-and-media.test.mjs`

Expected: PASS.

### Task 4: Add Private Media Boundary

**Files:**
- Create: `server/protected-media.mjs`
- Create: `protected-media/creator-censored-1.jpg`
- Create: `protected-media/creator-censored-2.jpg`
- Remove: `assets/creator-censored-1.jpg`
- Remove: `assets/creator-censored-2.jpg`
- Test: `test/auth-and-media.test.mjs`

**Interfaces:**
- Produces: `MEDIA_BY_ID`, `getProtectedMedia(env, mediaId, seedPayloads): Promise<Response>`.
- Consumes: generated `seedPayloads` keyed by explicit media ID.

- [ ] **Step 1: Move only reviewed censored derivatives**

Move exact files into `protected-media/`; preserve original external photographs untouched.

- [ ] **Step 2: Implement fixed media allowlist**

```js
export const MEDIA_BY_ID = Object.freeze({
  'creator-1': { key: 'creator/creator-censored-1.jpg', contentType: 'image/jpeg' },
  'creator-2': { key: 'creator/creator-censored-2.jpg', contentType: 'image/jpeg' },
});
```

- [ ] **Step 3: Implement private R2 read and first-authorized-request seed**

For an allowlisted ID, call `env.MEDIA.get(key)`. If absent, decode only its server-bundled censored payload, call `env.MEDIA.put(key, bytes, { httpMetadata: { contentType } })`, then return bytes. Unknown IDs return `404`; storage failures return `503`.

- [ ] **Step 4: Add defensive response headers**

```js
{
  'Content-Type': contentType,
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Vary': 'Authorization, Cookie',
}
```

- [ ] **Step 5: Run media-focused tests and confirm GREEN**

Run: `node --test --test-name-pattern="media|R2|bytes|nosniff" test/auth-and-media.test.mjs`

Expected: PASS.

### Task 5: Compose Protected Worker APIs

**Files:**
- Create: `server/worker.mjs`
- Create: `server/generated-content.mjs`
- Test: `test/auth-and-media.test.mjs`

**Interfaces:**
- Produces: `createWorker(dependencies): { fetch(request: Request, env: Env): Promise<Response> }` and default production Worker.
- Consumes: auth wrapper, D1 store, protected media, generated public pages, generated media payloads.

- [ ] **Step 1: Implement public routes unchanged**

Return generated homepage for `/`, generated live page for every configured `/live/*` route, and existing `robots.txt`. Preserve centralized referral replacement.

- [ ] **Step 2: Implement `GET /api/access-status`**

Authenticate, then return exact JSON state from `hasCurrentAttestation()`. Apply `private, no-store` and `Vary` headers.

- [ ] **Step 3: Implement `POST /api/age-attestation`**

Authenticate, require `Content-Type: application/json`, parse `{ confirmed: true }`, write server-derived user ID/timestamp/current policy, and return `204`.

- [ ] **Step 4: Implement `GET /api/media/:mediaId`**

Authenticate, require current attestation, then delegate only allowlisted ID to `getProtectedMedia()`.

- [ ] **Step 5: Run full Worker tests and confirm GREEN**

Run: `node --test test/auth-and-media.test.mjs`

Expected: all auth, attestation, media, header, and fail-closed tests PASS.

### Task 6: Add Accessible Clerk and Age-Gate UI

**Files:**
- Modify: `index.html`
- Modify: `script.js`
- Modify: `styles.css`
- Modify: `tracking.js`
- Test: `test/site-contract.test.mjs`

**Interfaces:**
- Consumes: ClerkJS, `/api/access-status`, `/api/age-attestation`, `/api/media/creator-1`, `/api/media/creator-2`.
- Produces: `initializeProtectedMediaGate()`, `loadProtectedImages(token)`, and DOM states `signed-out`, `needs-attestation`, `authorized`, `error`.

- [ ] **Step 1: Replace public creator sources with abstract placeholders**

Use `assets/hero-abstract.png` in public markup. Add `data-protected-media="creator-1"` and `data-protected-media="creator-2"`; do not include protected filenames or R2 keys.

- [ ] **Step 2: Add account-gate markup**

Add a live region, `Sign in to unlock 18+ previews`, Clerk account mount point, explicit unchecked checkbox labeled `I confirm that I am 18 years of age or older.`, confirmation button, retry action, and self-attestation disclosure.

- [ ] **Step 3: Implement Clerk state and API requests**

Initialize Clerk from injected `meta[name="clerk-publishable-key"]`. Retrieve `await clerk.session.getToken()`, send `Authorization: Bearer ${token}`, render one UI state at a time, and never start media requests before both authentication and attestation pass.

- [ ] **Step 4: Load and clean protected blobs**

Fetch each media endpoint, set `URL.createObjectURL(await response.blob())`, track URLs in a `Set`, and call `URL.revokeObjectURL()` on replacement, sign-out, and `pagehide`.

- [ ] **Step 5: Add privacy-safe events**

Record only `auth_prompt_view`, `age_attestation_complete`, and `protected_media_unlocked`. Never include Clerk identifiers, email, token, or birth data.

- [ ] **Step 6: Style accessible responsive states**

Preserve current dark editorial design, visible `:focus-visible`, minimum 52px actions, mobile sticky CTA, reduced motion, and clear error contrast.

- [ ] **Step 7: Run UI contract tests and confirm GREEN**

Run: `node --test test/site-contract.test.mjs`

Expected: referral and UI security contracts PASS.

### Task 7: Rebuild Pipeline Without Public Media Leakage

**Files:**
- Modify: `scripts/build.mjs`
- Modify: `scripts/serve.mjs`
- Modify: `scripts/validate-site.mjs`
- Modify: `.gitignore`
- Test: `test/site-contract.test.mjs`

**Interfaces:**
- Produces: bundled `dist/script.js`, bundled `dist/server/index.js`, copied migration, and public static output without creator JPGs.

- [ ] **Step 1: Generate server-only content module**

Build script reads both reviewed censored JPGs, encodes them into `server/generated-content.mjs`, and exports only server imports. Add generated module to `.gitignore`.

- [ ] **Step 2: Bundle client and Worker**

Use esbuild with browser platform for `script.js` and neutral/worker-compatible ESM for `server/worker.mjs`. Keep protected payloads only in `dist/server/index.js`.

- [ ] **Step 3: Inject runtime Clerk publishable key safely**

Worker replaces `{{CLERK_PUBLISHABLE_KEY}}` in homepage response from `env.CLERK_PUBLISHABLE_KEY`; no secret replacement exists.

- [ ] **Step 4: Copy only public files and migrations**

Public static list contains abstract image only. Copy `.openai/hosting.json` and `.openai/drizzle/0001_age_attestations.sql` into `dist/.openai/`.

- [ ] **Step 5: Extend validator**

Require auth controls, protected data attributes, D1/R2 binding names, migration, server modules, no creator filenames in public markup, and no creator JPG under public output.

- [ ] **Step 6: Extend local preview harness**

Preview server delegates page/API routes to built Worker with explicit fake Clerk/D1/R2 bindings only when `LOCAL_AUTH_TEST_MODE=1`; default local preview shows fail-closed auth configuration state.

- [ ] **Step 7: Run complete RED-to-GREEN proof**

Run: `npm test`

Run: `npm run validate`

Run: `npm run build`

Run: `npm test`

Expected: all commands exit `0`; build reports protected Worker and public file totals; post-build leakage contract passes.

### Task 8: Security and Browser Verification

**Files:**
- Remove: `tmp/imagegen/photo-1-source.png`
- Remove: `tmp/imagegen/photo-2-source.png`
- Remove: `tmp/imagegen/censor.cjs`
- Remove: `tmp/imagegen/desktop-censored-funnel.png`

**Interfaces:**
- Consumes: built local preview and fake auth states.
- Produces: verification evidence only.

- [ ] **Step 1: Remove raw temporary copies after exact path validation**

Resolve each target beneath `D:\StripChatReferralSite\tmp\imagegen`, delete only the four named files, and confirm external originals remain untouched.

- [ ] **Step 2: Prove public denial**

Request both `/assets/creator-censored-*.jpg` paths and both `/api/media/*` paths without auth. Expect static paths `404` and protected paths `401` with no bytes.

- [ ] **Step 3: Prove account/attestation state machine locally**

With fake-auth test mode, verify signed-out, signed-in/unattested, and attested states. Confirm only attested state renders both censored images.

- [ ] **Step 4: Prove responsive and accessibility behavior**

Check desktop and 390x844 viewport, keyboard focus, no horizontal overflow, image natural dimensions, console/runtime errors, and accessibility audit.

- [ ] **Step 5: Run final repository checks**

Run: `git diff --check`

Run: `git status --short`

Review every staged candidate; exclude `.codex/`, `.superdesign/`, `tmp/`, secrets, logs, raw inputs, and screenshots.

### Task 9: Configure Clerk, Commit, and Publish Proven Version

**Files:**
- Stage only reviewed source, lockfile, protected censored derivatives, spec, plan, schema, and migration.

**Interfaces:**
- Consumes: user-provided or existing Clerk Publishable Key and Secret Key; exact Sites project ID `appgprj_6a7055913a088191a6c47b7b11c652cb`.
- Produces: one verified commit and one deployed Sites version.

- [ ] **Step 1: Inspect current hosted config without exposing values**

Read Sites environment-variable names and site access. Require `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_AUTHORIZED_PARTIES`, and `AGE_POLICY_VERSION`; request missing values from user without placing secrets in chat, source, shell history, or logs.

- [ ] **Step 2: Configure hosted values securely**

Set publishable/runtime values and secret through Sites environment controls. Do not print returned values.

- [ ] **Step 3: Run final proof after config shape is known**

Run: `npm test`

Run: `npm run validate`

Run: `npm run build`

Run: `git diff --check`

Expected: every command exits `0`.

- [ ] **Step 4: Create focused commit**

```bash
git commit -m "feat: protect creator previews with Clerk age gate"
```

Record commit hash and exact file list. Never amend or force-push.

- [ ] **Step 5: Package and save exact commit**

Obtain Sites source credential, push exact branch-head commit using per-command authorization header, package proven `dist/`, and save one version with commit SHA.

- [ ] **Step 6: Publish with verified access**

Read current site access. If not verifiably owner-only, request deployment approval naming resolved access; user’s current publication authorization satisfies public deployment only if resolved access matches the site they asked to publish. Deploy saved version and poll until terminal success/failure.

- [ ] **Step 7: Runtime smoke test**

Verify public homepage, every `/live/*` source route, unauthenticated protected-media denial, Clerk sign-in surface, current referral CTA, no runtime errors, and deployed headers. Do not claim signed-in/attested production success without actual Clerk credentials and an actual test account.

- [ ] **Step 8: Report**

Report files changed, visual/auth flow, referral funnel, exact PASS/FAIL commands, remaining credential/runtime gaps, commit hash, push/deployment result, live URL, and next task.
