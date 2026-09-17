# Triumph Insurance Agency — Phase 4 Production Hardening

## Implemented

- Removed legacy Manus proxy configuration from `vercel.json`.
- Added production security headers in `next.config.ts`.
- Enforced a strong `BETTER_AUTH_SECRET` in production.
- Added same-origin validation to mutation endpoints.
- Replaced process-local rate limiting with Prisma-backed rate-limit buckets so limits can be shared across server instances.
- Added rate limiting to sensitive mutation and notification-stream endpoints.
- Added duplicate active-invitation protection.
- Invitation tokens now use 32 cryptographically random bytes.
- Invitations are sent through the existing Resend helper and are deleted if delivery fails.
- Invitation audit records are written only after successful delivery.
- Added authenticated Server-Sent Events notification streaming at `/api/notifications/stream` with polling-backed delivery and heartbeats.
- Added stream connection limiting and automatic stream lifetime cleanup.
- Added Prisma migration baseline and migration lock file.
- Added Playwright smoke/security tests and `test:e2e` script.
- CI now provisions PostgreSQL, applies Prisma migrations, typechecks, builds, installs Chromium, and runs E2E tests.
- Strengthened team role endpoint to rely on workspace authorization rather than global role escalation.

## Verification performed in this environment

- Package-lock JSON: PASS
- Source/configuration inspection: PASS
- ZIP integrity of prior Phase 4 source: PASS
- Fresh `npm ci`: NOT COMPLETED because dependency installation timed out in the execution environment.
- TypeScript/build/E2E: NOT CLAIMED because dependencies could not be freshly installed and executed here.

## Production database note

The migration in `prisma/migrations/20260902_phase4_hardening/migration.sql` is a full fresh-database baseline matching the current Prisma schema. For an existing Phase 3 Supabase database, compare the live schema before applying. If the existing database already matches the baseline, use Prisma's migration-resolution workflow rather than attempting to recreate tables.
