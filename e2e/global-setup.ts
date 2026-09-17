import { Pool } from 'pg';

/**
 * Fails fast with one clear error instead of dozens of confusing individual
 * test failures if the test database isn't reachable. Migrations are
 * expected to already be applied (`npm run db:migrate`) before the suite
 * runs - this only checks connectivity and that the schema looks migrated.
 */
export default async function globalSetup() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Point it at the Postgres database your dev server uses ' +
      '(the same one you ran `npm run db:migrate` / `npm run db:seed` against) before running the E2E suite.'
    );
  }
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const result = await pool.query(
      `SELECT to_regclass('"User"') AS "user", to_regclass('"Membership"') AS "membership"`
    );
    const row = result.rows[0];
    if (!row.user || !row.membership) {
      throw new Error(
        'Connected to the database, but the "User"/"Membership" tables were not found. ' +
        'Run `npm run db:migrate` against this DATABASE_URL before running the E2E suite.'
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('tables were not found')) throw error;
    throw new Error(
      `Could not connect to Postgres at DATABASE_URL for E2E setup: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  } finally {
    await pool.end();
  }
}
