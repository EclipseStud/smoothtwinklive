# Clerk Account-Bound 18+ Media Gate

## Objective

Keep EclipseStud referral pages fast and public while making the two censored creator images available only to a signed-in Clerk account that has completed a one-time 18+ self-attestation.

This is self-attestation, not identity-document or third-party age verification. The UI and code must not describe it as verified age.

## Existing Behavior Preserved

- Existing EclipseStud branding, layout, responsive behavior, source routes, and analytics remain intact.
- `/live`, `/live/x`, `/live/reddit`, `/live/bluesky`, `/live/ad`, and `/live/direct` remain public.
- Every StripChat CTA continues to resolve through the centralized referral helper to `https://stripchat.com/SmoothTwinkVibes/follow-me`.
- The public page keeps an abstract social-preview image and contains no protected creator-media bytes.
- No deployment, publication, commit, or push is part of this work.

## Architecture

### Clerk authentication

- ClerkJS provides sign-up, sign-in, account, and session UI in the browser.
- `CLERK_PUBLISHABLE_KEY` is a public runtime/build value used by ClerkJS.
- `CLERK_SECRET_KEY` is a server-only hosted secret and must never appear in source, HTML, client JavaScript, logs, or static output.
- The Worker validates session tokens server-side with Clerk `authenticateRequest()`.
- Authentication accepts only session tokens and sets `authorizedParties` from a centralized allowlist containing approved production origins plus explicit local-development origins.
- Missing or invalid authentication returns `401` without revealing media existence.

### Durable 18+ self-attestation

- D1 binding name: `DB`.
- One table stores one row per Clerk user:

```sql
CREATE TABLE age_attestations (
  clerk_user_id TEXT PRIMARY KEY NOT NULL,
  attested_at TEXT NOT NULL,
  policy_version TEXT NOT NULL
);
```

- `clerk_user_id` comes only from the server-verified Clerk session.
- `attested_at` is generated server-side in UTC.
- `policy_version` allows a future policy change to require renewed confirmation.
- Browser storage and Clerk unsafe metadata are not authorization sources.

### Private media storage

- R2 binding name: `MEDIA`.
- Stable object keys:
  - `creator/creator-censored-1.jpg`
  - `creator/creator-censored-2.jpg`
- Creator images are removed from the public static-file list and excluded from `dist/assets`.
- Source images remain local inputs until an explicitly authorized upload/deployment workflow places only censored derivatives into private R2.
- Public markup uses abstract placeholders until protected media loads.

## Request Flow

1. Public visitor sees the existing referral page with abstract placeholders and a `Sign in to unlock 18+ previews` action.
2. Clerk handles sign-up or sign-in.
3. Signed-in visitor without a current attestation sees a focused confirmation:
   - `I confirm that I am 18 years of age or older.`
   - Confirmation is explicit and never preselected.
4. Browser sends Clerk session token to `POST /api/age-attestation`.
5. Worker verifies the Clerk session, then inserts or updates the D1 row using the current policy version.
6. Browser requests `/api/media/creator-1` or `/api/media/creator-2` with the Clerk session token.
7. Worker verifies session, checks D1 attestation, reads the corresponding private R2 object, and returns the bytes.
8. Browser creates temporary object URLs for `<img>` elements and revokes them when replaced or unloaded.

## Server Endpoints

### `GET /api/access-status`

- `401` when no valid Clerk session exists.
- `200 { authenticated: true, ageAttested: false }` when signed in without current attestation.
- `200 { authenticated: true, ageAttested: true }` when allowed.
- Response headers: `Cache-Control: private, no-store` and `Vary: Authorization, Cookie`.

### `POST /api/age-attestation`

- Requires valid Clerk session.
- Requires JSON body `{ "confirmed": true }`.
- Rejects missing/false confirmation with `400`.
- Upserts server-derived Clerk user ID, server timestamp, and current policy version.
- Returns `204`.

### `GET /api/media/:mediaId`

- Allows only explicit IDs `creator-1` and `creator-2`; no caller-controlled R2 key.
- Requires valid Clerk session and current D1 attestation.
- Returns `401` for missing/invalid session, `403` for missing/current-policy attestation, and `404` for unknown IDs or missing objects.
- Success headers include exact image content type, `X-Content-Type-Options: nosniff`, and `Cache-Control: private, no-store`.

## UI States

- Loading: neutral placeholder; no image request starts before Clerk state resolves.
- Signed out: sign-in action and non-graphic explanation.
- Signed in, not attested: one checkbox plus confirmation button.
- Authorized: load both protected images; keep existing responsive crops and alt text.
- Error: show concise retry/sign-in message; keep placeholders.
- Account menu includes sign out.
- Keyboard focus, screen-reader labels, contrast, and reduced-motion behavior remain accessible.

## Analytics and Privacy

- Existing referral analytics remain first-party and session-scoped.
- Add only non-identifying events: `auth_prompt_view`, `age_attestation_complete`, and `protected_media_unlocked`.
- Never record Clerk user IDs, email addresses, tokens, birth dates, or image response data in analytics.

## Configuration

Tracked example values:

```ini
CLERK_PUBLISHABLE_KEY=
CLERK_AUTHORIZED_PARTIES=http://localhost:4173,https://smoothtwinklive.com
AGE_POLICY_VERSION=1
```

Hosted secret:

```ini
CLERK_SECRET_KEY=
```

`.env` remains ignored. `.env.example` contains names and safe examples only. Build and validation must fail closed when production auth config is incomplete; local automated tests use explicit fakes.

## Build Changes

- Add Cloudflare Worker-compatible Clerk backend dependency and bundle Worker output.
- Add logical D1 `DB` and R2 `MEDIA` bindings in `.openai/hosting.json`.
- Add D1 schema and generated migration.
- Stop copying protected JPGs into `dist/assets`.
- Keep all Clerk and age-gate configuration centralized.
- Preserve current static homepage/live-page generation and referral URL replacement.

## Verification

- Contract tests confirm exact referral URL and all `/live/*` routes remain unchanged.
- Auth tests cover missing token, invalid token, valid account, authorized-party rejection, and server errors.
- Attestation tests cover false confirmation, first insert, idempotent repeat, and policy-version mismatch.
- Media tests prove unauthenticated and unattested users receive no bytes; attested users receive only allowlisted censored media.
- Build test proves protected JPGs do not exist under `dist/assets` or any public static output.
- Security-header tests cover `private, no-store`, `Vary`, and `nosniff`.
- Existing `npm test`, `npm run validate`, and `npm run build` run after implementation.
- Local browser QA uses test Clerk credentials or a documented fake-auth harness; no production secret enters browser code.

## Failure Handling

- Missing Clerk server configuration: protected endpoints return `503`; public referral funnel remains usable.
- Clerk unavailable: keep placeholders and offer retry; do not bypass authorization.
- D1 unavailable: fail closed with `503`; do not serve media.
- R2 unavailable or object missing: return `404`/`503`; do not fall back to public files.
- Expired session: return `401`, clear temporary object URLs, and return UI to sign-in state.

## Non-Goals

- Government-ID or biometric age verification.
- Subscription billing or paid access.
- Public delivery of protected image URLs.
- DRM, screenshot prevention, or prevention of an authorized viewer saving rendered media.
- Changes to StripChat referral routing, branding, or unrelated site sections.

## Required User Inputs Before Live Verification

- Clerk Publishable Key.
- Clerk Secret Key, configured only as a hosted/local secret.
- Clerk application allowed origins and redirect URLs matching local preview and final production domain.
- Explicit authorization for any future R2 upload and Sites deployment.
