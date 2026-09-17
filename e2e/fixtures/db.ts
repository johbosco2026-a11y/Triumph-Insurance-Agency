import { Pool } from 'pg';

/**
 * Direct Postgres access for E2E test fixtures.
 *
 * This deliberately talks to the database with raw SQL via `pg`, not
 * through `@prisma/client` - E2E test setup shouldn't depend on the app's
 * generated client, and there are exactly two things the app has no
 * API/UI path for that a realistic test suite still needs:
 *
 *  1. Promoting a user's *global* Role (USER/AGENT/MANAGER/ADMIN). This is
 *     distinct from a workspace's Membership.role (OWNER/ADMIN/MEMBER/VIEWER,
 *     managed via /dashboard/team) - global role is what gates request
 *     status changes, assignment, and /api/reports (see
 *     app/api/requests/[id]/route.ts, .../assign/route.ts,
 *     app/api/reports/route.ts), and nothing in the app lets a user change
 *     it themselves.
 *  2. Reading a password-reset token back out of Better Auth's own
 *     Verification table, since email delivery is skipped in dev/test
 *     (see lib/email.ts) and there is no inbox to read a link from.
 *
 * Everything else in the test suite goes through real HTTP calls to the
 * app's real endpoints - this file is intentionally narrow.
 */

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is not set. The E2E suite talks to Postgres directly for a couple of ' +
        'fixture-only operations - set DATABASE_URL to the same database your dev server uses.'
      );
    }
    pool = new Pool({ connectionString, max: 5 });
  }
  return pool;
}

export type GlobalRole = 'USER' | 'AGENT' | 'MANAGER' | 'ADMIN';

/** Promotes a user's global Role directly in the database. See file header. */
export async function promoteGlobalRole(userId: string, role: GlobalRole): Promise<void> {
  const result = await getPool().query('UPDATE "User" SET role = $1 WHERE id = $2', [role, userId]);
  if (result.rowCount === 0) {
    throw new Error(`promoteGlobalRole: no User row found for id ${userId}`);
  }
}

/**
 * Reads back the most recent password-reset token issued to `userId` at or
 * after `sinceISO`. Better Auth stores these as
 * identifier = "reset-password:<token>", value = the user's id (see
 * node_modules/better-auth/dist/api/routes/password.mjs) - scoping by userId
 * rather than "most recent row overall" keeps this race-free when tests run
 * in parallel.
 */
export async function getLatestPasswordResetToken(userId: string, sinceISO: string): Promise<string | null> {
  const result = await getPool().query(
    `SELECT identifier FROM "Verification"
     WHERE value = $1 AND identifier LIKE 'reset-password:%' AND "createdAt" >= $2
     ORDER BY "createdAt" DESC LIMIT 1`,
    [userId, new Date(sinceISO)]
  );
  if (result.rows.length === 0) return null;
  const identifier: string = result.rows[0].identifier;
  return identifier.slice('reset-password:'.length);
}

/** Call once at the end of a test run (see global-teardown) to release connections. */
export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
