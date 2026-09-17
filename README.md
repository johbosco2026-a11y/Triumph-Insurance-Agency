# Triumph Insurance Agency SaaS

Production-oriented insurance operations platform built on the existing Triumph application foundation.

## Stack

- Next.js 16 App Router
- TypeScript
- Better Auth
- Prisma + PostgreSQL / Supabase
- tRPC
- Resend
- Playwright
- Organization and role-based access control

## Core modules

- Public insurance website
- Authentication and protected dashboard
- Organizations and memberships
- Customer management
- Insurance request workflow
- Agent assignment
- Manager approvals
- Team invitations
- Notifications
- Audit logs
- Operational reports

## Phase 4 hardening

- Security headers and CSP
- Same-origin checks for JSON mutations
- Rate limiting on sensitive/public endpoints
- Production secret enforcement
- Resend invitation delivery
- Authenticated notification SSE stream
- Prisma migration baseline
- Playwright E2E smoke/security tests

## Setup

```bash
cp .env.example .env.local
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Run checks:

```bash
npm run typecheck
npm run build
npm run test:e2e
```

## Production environment

Set real values for:

```env
DATABASE_URL=
DIRECT_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

`BETTER_AUTH_SECRET` must be a strong value of at least 32 characters in production.

## Prisma migrations

The repository contains a Phase 4 baseline migration. If you already have a database created by an earlier Triumph phase, inspect the live schema and migration history before applying the baseline. Never overwrite production data to make the migration pass.

## E2E testing

Public and protected-route smoke tests can run immediately after dependencies and the application are configured.

For the authenticated smoke test:

```bash
E2E_EMAIL=your-test-user@example.com E2E_PASSWORD=your-test-password npm run test:e2e
```

For CI, use repository secrets rather than committing credentials.

## Production hardening notes

The built-in rate limiter is process-local. For multiple Vercel/serverless instances, replace it with a shared Redis/Upstash-backed limiter.

The notification SSE endpoint uses an authenticated short polling loop. For high-volume deployments, migrate the event source to Supabase Realtime or a managed pub/sub system.

## Deployment

For Vercel:

1. Import the repository.
2. Configure production environment variables.
3. Configure the production Better Auth URL.
4. Configure Google OAuth production callback URLs if enabled.
5. Verify the Resend sending domain.
6. Run/verify Prisma migrations against the intended Supabase database.
7. Run the production build.
8. Run E2E tests against the deployment.

Do not deploy with placeholder provider credentials.

## Phase 4 production hardening

- Prisma-backed rate-limit buckets are used for sensitive API mutations.
- Security headers are configured in `next.config.ts`.
- Mutation routes validate same-origin requests when an Origin header is supplied.
- Team invitations are delivered through Resend and use 256-bit random tokens.
- Active duplicate invitations are rejected and expired invitations cannot be accepted.
- Authenticated notification streaming is available at `/api/notifications/stream`.
- Playwright smoke/security tests live under `e2e/`.
- CI provisions PostgreSQL, runs Prisma generation/typecheck/build, installs Chromium, and runs E2E tests.

### Production database migration

For a fresh database, `prisma migrate deploy` applies the supplied Phase 4 baseline. For an existing Phase 3 Supabase database, do not blindly run this baseline against the populated database. First compare the live schema with `prisma/schema.prisma`; if it already matches, mark the baseline migration as applied with `prisma migrate resolve --applied 20260902_phase4_hardening` after verification. Otherwise generate an environment-specific delta migration and deploy that instead.
