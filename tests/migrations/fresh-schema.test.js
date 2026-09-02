const fs = require('fs');
const path = require('path');
/**
 * Verifies the fresh-database path without touching production data.
 *
 * Creates a throwaway schema, points search_path at it, runs every migration
 * into it, checks what came out, and drops it again. The migrations use
 * unqualified names, so they land in the temporary schema rather than public.
 */
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'apps', 'api', '.env') });


const API = path.join(__dirname, '..', '..', 'apps', 'api');
const { getPool, closePool } = require(path.join(API, 'src/infrastructure/database/pool'));
const { migrationFiles } = require(path.join(API, 'src/infrastructure/database/migrate'));

const MIGRATIONS = path.join(__dirname, '..', '..', 'database', 'migrations');
const SCHEMA = 'migration_smoke_test';

(async () => {
  const client = await getPool().connect();
  let failed = false;
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await client.query(`CREATE SCHEMA ${SCHEMA}`);
    await client.query(`SET search_path TO ${SCHEMA}, public`);

    const files = migrationFiles();
    console.log('  migrations found: ' + files.join(', '));

    for (const name of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS, name), 'utf8');
      await client.query(sql);
      console.log('  applied ' + name);
    }

    const { rows } = await client.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = $1 ORDER BY table_name`,
      [SCHEMA]
    );
    const tables = rows.map((r) => r.table_name);
    console.log('  tables created: ' + tables.length + ' -> ' + tables.join(', '));

    const expected = ['budgets', 'chat_messages', 'expenses', 'feedback',
      'goal_contributions', 'goals', 'income', 'notifications',
      'refresh_tokens', 'users'];
    const missing = expected.filter((t) => !tables.includes(t));
    if (missing.length) {
      console.log('  FAIL missing: ' + missing.join(', '));
      failed = true;
    } else {
      console.log('  ok: a fresh database gets the complete schema');
    }

    // Running them a second time into the same schema must not error.
    for (const name of files) {
      await client.query(fs.readFileSync(path.join(MIGRATIONS, name), 'utf8'));
    }
    console.log('  ok: re-applying the same migrations is harmless');
  } catch (err) {
    console.log('  FAIL ' + err.message);
    failed = true;
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`).catch(() => {});
    await client.query('SET search_path TO public').catch(() => {});
    client.release();
    await closePool();
  }
  process.exit(failed ? 1 : 0);
})();
