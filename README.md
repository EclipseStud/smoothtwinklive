# SmoothTwinkVibes referral landing page

Static ESM adults-only referral site with a Sites Worker, D1-backed anonymous 30-day preview sessions, and private R2 creator media.

Every main CTA intentionally resolves through `site-config.mjs` to:

`https://stripchat.com/SmoothTwinkVibes/follow-me`

## Commands

```powershell
npm test
npm run validate
npm run build
npm run preview
```

`npm run build` writes deployable files, Worker code, and D1 migrations to `dist/`. `npm run preview` serves the local build at `http://localhost:4173`; production Worker requests redirect HTTP to HTTPS and send one-year HSTS.

Preview confirmation is adult self-attestation, not identity or ID verification. D1 stores only an opaque-token SHA-256 hash, attestation time, expiration, and policy version. Protected creator JPGs stay outside public static assets and are served only from private R2 after a valid preview session.
