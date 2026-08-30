# Why Follow Superdesign Implementation and Existing-Site Delivery Plan

## Goal

Translate Superdesign project `c10eb468-2654-41c8-9e74-c5aa9269e970`, draft `58bf5564-ed98-4847-b79f-8b8be0961d4e` (`Why Follow SmoothTwinkVibes`), into the existing `/why-follow` route and deliver it only as a new version of the existing ChatGPT Site `appgprj_6a7055913a088191a6c47b7b11c652cb` after local preview approval.

The mobile result must follow the supplied 390px reference: compact `STV` header, stacked hero, full-width primary CTA, creator visual directly below the CTA, and no `PUBLIC EDITORIAL PLACEHOLDER · NOT CREATOR LIKENESS` caption.

## Architecture

Keep the current static ESM Node/Sites Worker architecture. Translate the draft's visual system into semantic HTML in `why-follow.html` and narrowly scoped CSS in `styles.css`. Do not copy the draft's Tailwind CDN, Petite-Vue, Google Fonts, Iconify, or `sd-component` runtime. Continue using the existing build, Worker, referral-link replacement, tracking, D1, R2, and Sites hosting paths.

## Tech Stack

- Semantic HTML5
- Existing plain CSS token system in `styles.css`
- Existing browser ESM compiled with esbuild
- Existing Node test runner and source validator
- Existing Cloudflare-compatible Sites Worker output
- Existing ChatGPT Sites project and internal source repository

No dependency installation is required.

## Baseline and Authority References

Authority order when references conflict:

1. The user's current request and safety constraints.
2. The latest attached mobile screenshot at `C:\Users\bossc\AppData\Local\Temp\codex-clipboard-42cf6245-9143-4724-9da7-9f2c8640f8fa.png`.
3. The user-supplied `SiteHeader` and `SiteFooter` definitions.
4. Superdesign project `c10eb468-2654-41c8-9e74-c5aa9269e970`, draft `58bf5564-ed98-4847-b79f-8b8be0961d4e`, version 1.
5. Existing production contracts in `why-follow.html`, `why-follow.js`, `site-config.mjs`, `server/worker.mjs`, and the test suite.

Interpretation rules:

- Use the screenshot as a visual/layout reference, not as permission to retain its editorial-placeholder caption.
- Keep the actual creator brand `SmoothTwinkVibes`; do not shorten the hero brand to the draft's `SMOOTHTWINK.`.
- Keep existing factual, non-graphic copy. Do not add unsupported promises such as instant live notifications, premium audio, automatic redirection, private-session availability, discounts, or guarantees.
- Normalize the supplied profile link to the raw canonical URL `https://stripchat.com/SmoothTwinkVibes/follow-me`; never place Markdown link syntax in an `href`.

## Confirmed Existing-Site Baseline

- Repository: `D:\StripChatReferralSite\StripChatReferralSite`
- Branch: `codex/main`
- Baseline commit: `dd5ad0f`
- Existing dirty state to preserve: modified `sitemap.xml`; untracked `.vs/`
- Hosting project: `appgprj_6a7055913a088191a6c47b7b11c652cb`
- Site title: `SmoothTwinkLive - Adult Entertainment`
- Current live URL: `https://smoothtwinklive.com`
- Custom domain: `smoothtwinklive.com`, active with active SSL
- Existing Sites version at planning time: 4
- Access at planning time: owner-only custom access
- Existing bindings in `.openai/hosting.json`: D1 `DB`, R2 `MEDIA`
- Hosted environment keys present at revision 7: `PUBLIC_CREATOR_NAME`, `PUBLIC_SITE_NAME`, `PUBLIC_STRIPCHAT_REFERRAL_URL`

Re-read these values immediately before saving or deploying because hosted state can change.

## Compatibility Boundary

Must preserve:

- Routes `/`, `/why-follow`, `/live`, and existing live-source routes.
- Homepage hero text `WATCH ME LIVE ON STRIPCHAT.`.
- `site-config.mjs:getStripchatUrl()` as referral URL authority.
- `{{STRIPCHAT_REFERRAL_URL}}` build replacement.
- `data-referral-link` and unique `data-cta-location` tracking hooks.
- Exact external-link protections: `target="_blank" rel="noopener noreferrer"`.
- Existing metadata, canonical URLs, JSON-LD, robots, and sitemap behavior.
- Existing protected-media, anonymous preview-session, D1, and R2 architecture.
- Existing custom domain, access, environment variables, and all other Site settings.

Must not:

- Create a second Site or call `create_site`.
- Change `.openai/hosting.json` bindings.
- Call environment-variable or custom-domain mutation tools.
- Push to GitHub `origin`.
- Publish before the preview and approval gate.
- Redesign `/` or `/live` while implementing `/why-follow`.
- Commit `.vs/`, credentials, archives, screenshots, or generated temporary files.

## TDD Route

- Mode: off
- Decision: skipped
- Strict authority: not applicable
- Test posture: post-change regression plus focused source contracts
- Reason: this is a visual translation within established markup, tracking, and hosting contracts; it adds no new API or state behavior.
- Verification: update focused contracts alongside the implementation, then run validator, full tests, build, HTTP asset checks, and browser QA.

## Phase 1 - Freeze the Baseline

1. From `D:\StripChatReferralSite\StripChatReferralSite`, capture:

   ```powershell
   git rev-parse --show-toplevel
   git branch --show-current
   git rev-parse --short HEAD
   git status --short
   git diff -- sitemap.xml
   ```

2. Confirm the root, branch, and pre-existing dirty files match the baseline above.
3. Do not stash, reset, revert, clean, or edit `sitemap.xml` or `.vs/`.
4. Re-fetch the exact Superdesign draft by ID. Do not create or iterate a replacement draft.
5. Confirm `.superdesign/init/components.md`, `layouts.md`, `routes.md`, `theme.md`, `pages.md`, and `extractable-components.md` still exist and are non-empty.

Gate: stop if the repository root, Site project ID, or intended Superdesign draft differs.

## Phase 2 - Implement the `/why-follow` Markup

Files:

- Modify `why-follow.html`.
- Do not modify `index.html`, `live.html`, `site-config.mjs`, `server/worker.mjs`, or `.openai/hosting.json`.

Steps:

1. Add a page-specific body class, for example `why-follow-page`, so visual changes can be scoped away from `/` and `/live`.
2. Translate the supplied header into existing semantic HTML:
   - Desktop: gradient brand mark, `SmoothTwinkVibes`, `18+ only`, route-aware links, and canonical StripChat CTA.
   - Desktop route links: `/#vibe`, `/why-follow`, `/#faq`, and `/live` as appropriate.
   - Mobile at the existing `45rem` breakpoint: compact `STV` brand with `HOME`, `PREVIEW`, and `LIVE`, matching the screenshot and avoiding header overflow.
   - Hide the desktop header CTA on mobile; use the hero and mobile sticky CTA for conversion.
3. Preserve the screenshot's hero content hierarchy:
   - back-home link;
   - `THE DETAILS · 18+` eyebrow;
   - `WHY FOLLOW` and `SMOOTHTWINKVIBES` display lines;
   - existing factual supporting paragraph;
   - primary `OPEN MY STRIPCHAT` CTA.
4. Preserve the current creator image `src`, `srcset`, `sizes`, meaningful `alt`, and loading behavior.
5. Delete the `<figcaption>` containing `PUBLIC EDITORIAL PLACEHOLDER · NOT CREATOR LIKENESS`. Do not replace it with another disclaimer over the image.
6. Recompose the existing benefits into the draft-inspired glass-card rhythm while retaining factual current copy.
7. Recompose the existing clarity/disclosure content into a two-column desktop section that stacks on mobile. Retain the 18+ and external-platform disclosure.
8. Use a single intentional final CTA section. Do not create an accidental duplicate near the footer.
9. Add one mobile-only sticky CTA if it is not already present:
   - `data-referral-link`
   - `data-cta-location="why_follow_sticky_mobile"`
   - canonical placeholder URL
   - safe-area-aware spacing
10. Translate the supplied minimal footer for this page: gradient mark, `SmoothTwinkVibes`, adults-only external-platform sentence, and `18+ only`.
11. Preserve the current scripts and analytics hooks. `why-follow.js` should require no change because its delegated CTA query already tracks every `data-referral-link`.

Gate: source contains all required sections and no forbidden caption or unsupported marketing claim.

## Phase 3 - Translate the Visual System and Responsive Layout

File:

- Modify `styles.css` only under page-scoped selectors such as `.why-follow-page ...` or existing `.why-*` selectors that cannot affect other routes.

Steps:

1. Reuse the established dark pink/cyan/violet tokens; do not add CDN fonts or a second CSS framework.
2. Translate the draft's useful visual traits:
   - near-black background;
   - cyan/pink gradient brand mark;
   - oversized display headline;
   - glass panels with restrained borders;
   - hot-pink primary CTA;
   - cyan accents and clear muted copy;
   - subtle existing reveal motion with reduced-motion support.
3. Keep the desktop hero two-column and let it collapse at the existing `56rem` breakpoint.
4. At `45rem` and below, match the attached mobile reference:
   - compact 66px header;
   - hero padding and copy start below the header;
   - intentional headline wrapping with `SMOOTHTWINKVIBES` fully visible;
   - primary CTA at full available width;
   - creator visual immediately after the CTA;
   - rounded image with a stable crop;
   - benefits and disclosure cards in one column;
   - no horizontal overflow at 390px and 320px;
   - all tap targets at least 44px;
   - sticky CTA clears `env(safe-area-inset-bottom)` and does not cover footer content.
5. Remove the now-dead `.why-visual figcaption` rule.
6. Keep `body { overflow-x: hidden; }` only as a safety net; fix the element causing overflow rather than relying on clipping.
7. Verify desktop header/footer styles do not change the homepage or `/live` appearance.

Gate: desktop, tablet, and mobile layouts are coherent with no clipping, duplicate CTA, or caption.

## Phase 4 - Strengthen Contracts and Build Proof

Files:

- Modify `test/site-contract.test.mjs`.
- Modify `scripts/validate-site.mjs` only for deterministic `/why-follow` source checks.

Add checks for:

- required semantic header, main, and footer;
- required hero, benefits, clarity/disclosure, final CTA, and mobile sticky CTA;
- at least three uniquely located `/why-follow` referral CTAs after the sticky CTA is added;
- exact canonical placeholder and external-link attributes;
- absence of `PUBLIC EDITORIAL PLACEHOLDER` and `NOT CREATOR LIKENESS`;
- absence of Tailwind CDN, Google Fonts CDN, Iconify CDN, Petite-Vue, and `sd-component`;
- absence of unsupported claims identified in this plan;
- unchanged route and tracking contracts.

Run in this order:

```powershell
npm run validate
npm test
npm run build
git diff --check
```

Then verify build artifacts:

```powershell
Test-Path dist\server\index.js
Test-Path dist\.openai\hosting.json
Test-Path dist\styles.css
Test-Path dist\why-follow.html
Test-Path dist\why-follow.js
Test-Path dist\assets\creator-placeholder-v1-768.jpg
Test-Path dist\assets\creator-placeholder-v1-1536.jpg
```

Gate: every command exits successfully and all expected build artifacts exist.

## Phase 5 - Preview and Browser Verification

1. Start the existing preview without changing its port contract:

   ```powershell
   npm run preview
   ```

2. Require HTTP 200 for:
   - `/`
   - `/why-follow`
   - `/live`
   - `/styles.css`
   - `/why-follow.js`
   - both `/assets/creator-placeholder-v1-*.jpg` files
3. Open one stable Codex Site preview tab at `/why-follow` and reuse it.
4. Verify these viewport sizes:
   - desktop: 1440x900;
   - tablet: 768x1024;
   - mobile: 390x844;
   - narrow mobile: 320x720.
5. Verify visually and in the DOM:
   - desktop supplied header/footer direction is represented;
   - mobile matches the supplied compact composition;
   - full hero brand is visible;
   - caption is absent;
   - image is loaded, correctly cropped, and not a blank bordered area;
   - CTA URLs resolve exactly to `https://stripchat.com/SmoothTwinkVibes/follow-me` after build replacement;
   - nav links resolve to valid routes/anchors;
   - no duplicate unintended final CTA;
   - `document.documentElement.scrollWidth <= document.documentElement.clientWidth`;
   - no console/runtime error affects rendering.
6. Verify the homepage still says `WATCH ME LIVE ON STRIPCHAT.` and `/live` remains functional.
7. Show the preview to the user and stop for explicit publish approval.

Gate: do not save or deploy a Site version until the user approves the verified preview.

## Phase 6 - Save a New Version on the Existing Site

Run only after preview approval.

1. Re-read Site `appgprj_6a7055913a088191a6c47b7b11c652cb` with `get_site`.
2. Re-read custom domains and environment-variable metadata.
3. Confirm:
   - title remains `SmoothTwinkLive - Adult Entertainment`;
   - `smoothtwinklive.com` remains active;
   - D1 `DB` and R2 `MEDIA` remain in `.openai/hosting.json`;
   - all existing environment keys remain present;
   - no settings mutation is required.
4. Review the exact diff. Preserve `sitemap.xml` byte-for-byte from its pre-existing dirty state and exclude `.vs/`.
5. Create the required proven source commit only after the build and browser gates pass. Stage only the reviewed site files, focused contracts, the preserved `sitemap.xml` state, and plan records; never stage `.vs/`, credentials, QA captures, or archives.
6. Obtain a short-lived Sites source write credential for the existing project if the current one is missing or expired.
7. Push the exact commit to the connector-returned internal Sites repository and branch using per-command authentication. Do not add the token to a URL or Git configuration, do not trigger Git Credential Manager, and do not push GitHub `origin`.
8. Rebuild from that exact commit.
9. Package the successful `dist/` output with the Sites hosting helper so the archive contains `dist/server/index.js`, `dist/.openai/hosting.json`, static assets, and existing migrations.
10. Call `save_site_version` once with:
    - project ID `appgprj_6a7055913a088191a6c47b7b11c652cb`;
    - the pushed head SHA;
    - the archive built from that same SHA.
11. Record the returned opaque version ID and user-facing version number. Saving is not deployment.

Gate: stop if the pushed SHA, archive source, Site ID, domain, or environment revision cannot be reconciled exactly.

## Phase 7 - Deploy to the Existing Site and Verify Production

Run only after the user has approved the preview and the new saved version.

1. Reconfirm current access immediately before deployment.
2. Deploy the saved version to the existing project only. Because access was owner-only at planning time, use the owner-only deployment path only if `get_site` still proves exactly one allowed account user, no external visitors, and no workspace/tenant groups. Otherwise stop and request explicit approval for the resolved shared/public access path.
3. Poll the returned deployment ID until `succeeded` or `failed`.
4. Do not call domain or environment mutation tools.
5. Verify the actual custom domain, not only a deployment URL:
   - `https://smoothtwinklive.com/`
   - `https://smoothtwinklive.com/why-follow`
   - `https://smoothtwinklive.com/live`
   - production CSS, JS, and image assets return 200 with correct content types;
   - homepage hero remains `WATCH ME LIVE ON STRIPCHAT.`;
   - `/why-follow` mobile and desktop render correctly;
   - forbidden caption is absent;
   - no horizontal overflow;
   - CTA/referral URLs, navigation, footer, and runtime console are correct.
6. Re-read domain and environment state after deployment and compare it with the pre-deploy snapshot.
7. Reuse the same Codex Site tab for the final deployed URL.

Gate: deployment is complete only when the Sites deployment reports success and the custom domain passes all checks.

## Rollback and Stop Conditions

- If implementation breaks `/`, `/live`, tracking, protected media, D1/R2, or build output, stop and fix only the scoped regression before any Site version is saved.
- If preview does not match the mobile reference, stop before Sites source preparation.
- If Sites cannot save a new version from the exact validated source, do not change application architecture; report the connector error and exact manual action.
- If deployment fails, leave the prior live version and domain/settings intact; do not delete/recreate the Site, D1, R2, domain, or variables.
- If production assets return non-200 responses or wrong content types, stop, report the exact asset failure, and do not call the release verified.

## Expected File Changes

Implementation should be limited to:

- `why-follow.html`
- `styles.css`
- `test/site-contract.test.mjs`
- `scripts/validate-site.mjs`
- `docs/aegis/plans/2026-08-29-why-follow-superdesign-implementation.md`
- `docs/aegis/INDEX.md`

`why-follow.js` should remain unchanged unless verification proves the existing generic CTA tracking cannot cover the mobile sticky CTA. No other product files should change.

## Completion Criteria

- Superdesign direction is translated into the existing `/why-follow` route without a framework or CDN rewrite.
- Desktop uses the supplied polished header/footer direction.
- Mobile matches the supplied compact reference at 390px and remains usable at 320px.
- The editorial/likeness caption is absent on desktop and mobile.
- Existing factual copy, referral URL, tracking, routes, D1/R2, protected media, domain, environment variables, and settings are preserved.
- Local validator, tests, build, diff check, HTTP checks, and browser QA pass.
- The user previews and approves before publishing.
- One new version is saved and deployed to the existing Site only.
- `https://smoothtwinklive.com`, `/why-follow`, and `/live` pass final production verification.
