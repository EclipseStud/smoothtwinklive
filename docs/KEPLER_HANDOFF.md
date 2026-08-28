# SmoothTwinkVibes — Current Handoff

## Checkout and scope

- Active checkout: `D:\StripChatReferralSite\StripChatReferralSite`
- Branch: `codex/main`
- Project: static ESM Node/Sites Worker; no framework rewrite.
- Exact referral authority: `site-config.mjs:getStripchatUrl()` → `https://stripchat.com/SmoothTwinkVibes/follow-me`.
- Preserve unrelated dirty files. Do not push GitHub `origin`.

## Current implementation

- Premium creator homepage: deliberate hero lines, responsive public nightlife artwork, trust strip, benefit cards, asymmetric gallery, repeated CTAs, FAQ, final visual CTA, sticky glass nav, and mobile safe-area CTA.
- Dedicated `/why-follow` page. Navigation opens this route, not a homepage fragment.
- `/live` and all configured source routes use SmoothTwinkVibes branding.
- First-party tracking remains session-scoped through `tracking.js` and does not make network calls.
- HTTP requests receive `308` HTTPS redirects. HTTPS Worker responses include `Strict-Transport-Security: max-age=31536000`.

## Preview access

- One button: `I'M 18+ — SHOW PREVIEWS`.
- No account, identity provider, checkbox, or sign-in flow.
- `POST /api/preview-session` creates a random 256-bit opaque token.
- D1 stores only SHA-256 token hash, attestation time, expiration, and policy version.
- Cookie: `__Host-stv_preview_access`; 30 days; `Path=/; HttpOnly; Secure; SameSite=Lax`.
- `GET /api/preview-session` reports `{ "ageAttested": boolean }`.
- `/api/access-status` and `/api/age-attestation` remain anonymous-session aliases for compatibility.
- Private allowlisted R2 images fail closed on missing, expired, invalid, or policy-stale sessions.

Never copy `protected-media/creator-censored-*.jpg` into public assets, screenshots, reports, or handoff bundles. Generated public artwork is generic placeholder imagery and is explicitly not a creator likeness.

## Safe retirement boundary

- Runtime auth modules, UI, config, dependencies, and obsolete auth design docs are removed.
- `.openai/drizzle/0001_age_attestations.sql` remains immutable migration history.
- Production `age_attestations` rows/table and any external identity-provider tenant records are persistent state. Do not delete them without exact scoped confirmation.

## Verification sequence

Run serially because build regenerates `dist/`:

```powershell
npm run validate
npm test
npm run build
git diff --check
```

Then Dogfood at 1440×1000, 1280×800, 768×1024, 390×844, and 320×700. Keep protected media out of captures. Verify `/`, `/why-follow`, `/live`, first confirmation, remembered access, invalid/expired states, unavailable API fallback, keyboard FAQ, visible focus, reduced motion, sticky UI, and horizontal overflow.

Public Sites release is authorized only after all local checks and Dogfood pass. Use Sites-provided source credentials, not GitHub `origin`, then run hosted HTTPS, metadata, referral, D1 migration, session-cookie, private-R2, and fallback acceptance.
