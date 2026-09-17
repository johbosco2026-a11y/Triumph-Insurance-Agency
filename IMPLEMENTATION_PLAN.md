# Triumph Insurance Agency SaaS — Implementation Plan

## Current architecture

The repository is a Next.js 16 App Router project using TypeScript, Prisma targeting PostgreSQL, Better Auth, tRPC, Resend, and the existing Triumph CSS/hero asset. The public Next.js surface currently contains the homepage. The original static SPA bundle remains in the repository for reference but is not the active App Router implementation.

## Existing functionality

The repository has a working production build, Prisma schema generation, a Better Auth route handler, a tRPC route handler, a role-aware procedure helper, organization and membership models, insurance request and audit log models, Google OAuth environment hooks, a Resend helper, and responsive public styling.

## Missing functionality

The application still needs real signup, login, logout, password reset, session-aware redirects, dashboard routes, organization context, complete request CRUD and lifecycle transitions, customers, teams, reports, audit UI, notifications, explicit permission policies, tenant isolation, migrations, seeds, automated tests, and provider-connected verification.

## Broken or incomplete functionality

The active Next.js app has only a homepage. The current request list procedure is not organization-scoped, request creation is public and does not attach an authenticated user or tenant, runtime roles are not fully represented in the Better Auth user type, and there is no middleware protecting dashboard routes. No production credentials are present, so external provider flows cannot yet be verified.

## Security concerns

All protected pages and tRPC procedures must verify the Better Auth session. Every organization-owned read and mutation must derive the organization from server-side membership rather than trusting a client-supplied organization ID. Role checks must be centralized and tested. Audit records must be created server-side. Production must use a strong Better Auth secret and never expose provider credentials to client code.

## Database concerns

The schema needs Better Auth compatibility verification, migrations, a request assignment and history model, organization-scoped audit records, invitation records, and indexes for tenant/status queries. Supabase connection and migration execution remain pending until credentials are available.

## Authentication concerns

Phase 1 will add `/signup`, `/login`, `/forgot-password`, `/reset-password`, `/logout`, and `/dashboard`, with Better Auth sessions, Google OAuth, Resend password reset delivery, protected middleware, proper redirects, duplicate-account handling, and client/server session utilities.

## UI concerns

The Triumph public visual identity should remain intact. The dashboard will use a responsive application shell with role-sensitive sidebar navigation, a mobile drawer, loading skeletons, empty states, error recovery, accessible form errors, and touch-friendly controls.

## Implementation phases

1. **Authentication:** Better Auth schema alignment, real forms, sessions, Google, password reset, logout, protected routes.
2. **Dashboard:** Overview, request queues, customers, team, organizations, audit logs, settings, and role-aware navigation.
3. **Insurance workflow:** Create, read, edit, assign, status transitions, notes, filters, pagination, audit events, and Resend notifications.
4. **Authorization:** Explicit permission matrix, membership checks, tenant-scoped queries, and server-side security tests.
5. **Provider connection:** Supabase, Google, Resend, production URLs, and deployment secrets.
6. **Hardening:** Attack-path tests, responsive QA, accessibility, rate limiting, secure errors, migration verification, and final report.

## Testing plan

Run Prisma generation, TypeScript, lint, production build, unit tests for permission decisions and status transitions, integration tests for tenant isolation, and browser checks for signup, login, logout, password reset, redirects, dashboard navigation, forms, responsive layouts, loading, empty, and error states.

## Deployment plan

Deploy the Next.js app to a Node-compatible host such as Vercel. Configure `DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, Google credentials, Resend credentials, verified callback URLs, and the production sender domain. Run Prisma migrations before accepting traffic. Do not claim production readiness until provider connectivity and security tests pass.
