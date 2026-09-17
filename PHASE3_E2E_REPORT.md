# Phase 3 E2E — Completion Report

Scope: implement steps 3–4 of the outstanding plan (local Postgres, migrate + seed, write and run the full auth/RBAC/cross-tenant Playwright suite from `PHASE3_E2E.md`), then pause before step 5 (production Supabase/Google/Resend credentials).

## Suite delivered

35 tests across 9 spec files, covering all 14 critical flows in `PHASE3_E2E.md` plus edge cases:

- `e2e/auth.spec.ts` — signup→workspace creation, login, logout, duplicate-email signup, anonymous redirect, full forgot/reset-password round trip (real token read from the DB, no email inbox needed), missing-token rejection
- `e2e/customers.spec.ts` — customer creation + persistence, server-side search
- `e2e/requests.spec.ts` — request creation + persistence, internal notes
- `e2e/rbac-requests.spec.ts` — assignment (incl. cross-workspace assignee rejection), status-change notifications, manager-only approve/reject — all API-level, since the dashboard has no UI for assignment
- `e2e/team.spec.ts` — invite → accept, wrong-email acceptance rejection, duplicate pending invite rejection, role change with audit-log + notification, workspace-admin gating on invite/role-change/audit
- `e2e/reports.spec.ts` — reports reflect persisted data (API + UI), manager-only gating
- `e2e/tenant-isolation.spec.ts` — requests/customers/team/reports/invitations all scoped correctly across two independent workspaces

`e2e/smoke.spec.ts` and `e2e/security.spec.ts` (pre-existing) were left untouched.

### Test fixtures (`e2e/fixtures/`)

- `api.ts` creates accounts through Better Auth's real `POST /api/auth/sign-up/email` endpoint and provisions workspaces through the real `POST /api/onboarding` — not DB inserts — so password hashing and session issuance match production exactly. `addMemberToOrg` adds a second person to an existing workspace via the real invite→accept flow.
- `db.ts` is the *only* place the suite touches Postgres directly, for the two things the app has no API for: promoting a user's global `Role` (there's no self-serve UI for it), and reading a password-reset token back out of Better Auth's `Verification` table (email delivery is skipped outside production).
- `global-setup.ts` checks `DATABASE_URL` connectivity and that migrations have been applied before any test runs, with a specific error message for each failure mode.

## Bugs found and fixed

1. **Build-breaking:** `app/dashboard/requests/[id]/page.tsx` defined `NoteForm` with `<form action={async (formData) => {...}}>` inside a Server Component with no `'use server'` directive anywhere in the repo. Extracted into `app/dashboard/requests/[id]/note-form.tsx` as a client component using `fetch`, matching the pattern `status-form.tsx` already uses.
2. **Silently broken feature:** `lib/auth.ts` never configured `emailAndPassword.sendResetPassword`, so every forgot-password attempt failed with Better Auth's `RESET_PASSWORD_DISABLED` error. Wired it to the existing `sendSecurityEmail` helper (same helper `team/invite` already uses).
3. **Untestable/inaccessible markup:** the "new customer" and "invite member" forms had `<label>`/`<input>` pairs with no `id`/`htmlFor`/`name` association. Added minimal attributes (no behavior change) in `customers/page.tsx`, `team/page.tsx`, and `requests/new/page.tsx`; added `aria-label` to the status `<select>` and `data-testid` to per-row role selects.

## Bugs found and left alone (flagged for you, not fixed)

- **No UI for request assignment.** `POST /api/requests/[id]/assign` is fully built and guarded, but nothing in `app/dashboard` calls it. Tested at the API level.
- **Two disconnected role systems.** Team management and the audit log are gated by workspace `Membership.role` (OWNER/ADMIN); request status changes, assignment, and reports are gated by global `User.role` (AGENT/MANAGER/ADMIN). A workspace's own creator gets `Membership.role=OWNER` but `User.role=USER` by default, and there's no self-serve way to change the latter.
- **Dead success message.** In `customers/page.tsx`, the "Customer created" notice is nested inside the same conditional block that hides the form on success — it unmounts in the same render pass a user would never see it.
- **Rate limiter fallback.** `lib/security/rate-limit.ts` keys on `x-forwarded-for`/`x-real-ip`, falling back to a shared `'unknown'` bucket when neither header is present. Worth confirming your production deployment topology actually sets one of these, or the limiter degrades from per-client to global.

## Validated for real, here

Prisma's CLI needs a binary from `binaries.prisma.sh`, which this sandbox's network can't reach — so `next dev`/`build` and the live Playwright run couldn't happen in this environment. What *was* run for real:

- PostgreSQL 16 installed and started; `migration.sql` applied directly and cross-checked table-by-table against `schema.prisma` (clean, all 13 tables/indexes/FKs match)
- All 7 edited application files pass `esbuild` syntax validation
- All E2E files pass `tsc --noEmit --strict` with zero errors
- `npx playwright test --list` cleanly collects all 35 tests (proves imports/module resolution/syntax across every spec and fixture file)
- `db.ts`'s actual functions — role promotion, password-reset token lookup, and their error paths — executed against live Postgres with real fixture rows and verified via direct `psql` queries
- `global-setup.ts`'s all four branches (success, unreachable DB, missing env var, unmigrated schema) executed against real conditions

## To actually run it

Against your CI (which already provisions Postgres per `PHASE4_REPORT.md`) or any machine with normal network access:

```
npm install
npm run db:migrate
npm run test:e2e
```

No new environment variables are required — `DATABASE_URL` and `PLAYWRIGHT_BASE_URL` were already in `.env.example`.

## Next: step 5

Production Supabase/Google OAuth/Resend credentials — paste them when ready and I'll wire up the provider configuration.
