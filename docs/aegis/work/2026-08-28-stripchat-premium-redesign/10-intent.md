# SmoothTwinkVibes Premium Redesign - Intent

## TaskIntentDraft

- Requested outcome: Ship a premium high-energy creator referral site with one-click 18+ preview access, a dedicated why-follow route, HTTPS enforcement, complete Dogfood proof, and a public Sites release.
- Goal: Increase qualified StripChat click-through while keeping claims factual and protected creator media private.
- Success evidence:
- Focused RED-GREEN tests, full validation and build, multi-viewport browser QA, complete dogfood report, successful Sites deployment, and hosted HTTPS/referral/preview acceptance.
- Stop condition: Done when all proof and hosted acceptance pass; blocked on repeated external failure; needs-verification when hosted proof is unavailable; scope-exceeded if referral, access, or release authority must expand.
- Non-goals:
- No GitHub origin push, domain/access-policy change, fake claims, public creator JPGs, or unrelated cleanup.
- Scope: Homepage redesign, /why-follow route, /live alignment, anonymous D1 preview sessions, HTTPS/security headers, tests, build, Dogfood, and authorized public Sites deployment.
- Change kinds:
- architectural
- Risk hints:
- Public adult referral conversion, anonymous age self-attestation, D1 migration, R2 privacy, HTTPS, and deployment.

## BaselineReadSetHint

- index.html; styles.css; script.js; tracking.js; site-config.mjs; live.html; server/worker.mjs; historical server/auth.mjs; server/protected-media.mjs; test/*.test.mjs; scripts/*.mjs; .openai/hosting.json

## BaselineUsageDraft

- Required baseline refs:
- index.html; styles.css; script.js; tracking.js; site-config.mjs; live.html; server/worker.mjs; historical server/auth.mjs; server/protected-media.mjs; test/*.test.mjs; scripts/*.mjs; .openai/hosting.json
- Acknowledged before plan:
- All listed source, config, test, migration, and protected-media boundaries were inspected before implementation.
- Cited in plan:
- none
- Missing refs:
- none
- Advisory decision: baseline-satisfied

## ImpactStatementDraft

- Compatibility boundary: Preserve /api/access-status, /api/age-attestation, media allowlist, /live source routes, metadata, and public tracking contracts.
- Affected layers:
- Public UI, Worker API, D1 migration, R2 authorization, tests, build, Sites release
- Owners:
- Site-owning root agent
- Invariants:
- Exact referral URL and tracking attributes remain; protected creator JPGs never become public; legacy endpoint names remain anonymous-session aliases without external identity auth.
- Non-goals:
- No GitHub origin push, domain/access-policy change, fake claims, public creator JPGs, or unrelated cleanup.

These records are Method Pack drafts / hints, not authoritative runtime decisions.
