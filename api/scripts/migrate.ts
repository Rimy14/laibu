/**
 * Applies database/migrations/*.sql in filename order, each in its own
 * transaction. Applied files are checksummed: editing one that already ran is
 * refused (add a new migration instead). An advisory lock stops two deploys
 * migrating at once.
 *
 *   npm run db:migrate          apply pending migrations
 *   npm run db:migrate -- --seed   ...then load database/seeds/*.sql
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../database');
const LOCK_ID = 7_301_993; // arbitrary, constant

async function sqlFiles(dir: string) {
  const names = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  return Promise.all(
    names.map(async (name) => {
      const sql = await readFile(path.join(dir, name), 'utf8');
      return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    }),
  );
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (copy .env.example to .env)');

  const client = new pg.Client({ connectionString: url, application_name: 'laibu-migrate' });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name        text PRIMARY KEY,
        checksum    text NOT NULL,
        applied_at  timestamptz NOT NULL DEFAULT now()
      )`);
    const { rows } = await client.query<{ name: string; checksum: string }>(
      'SELECT name, checksum FROM schema_migrations',
    );
    const applied = new Map(rows.map((r) => [r.name, r.checksum]));

    let ran = 0;
    for (const m of await sqlFiles(path.join(root, 'migrations'))) {
      const prev = applied.get(m.name);
      if (prev) {
        if (prev !== m.checksum) {
          throw new Error(`${m.name} was changed after it was applied. Create a new migration instead.`);
        }
        continue;
      }
      process.stdout.write(`  applying ${m.name} ... `);
      await client.query('BEGIN');
      try {
        await client.query(m.sql);
        await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [m.name, m.checksum]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
      console.log('done');
      ran++;
    }
    console.log(ran ? `Applied ${ran} migration(s).` : 'Database is up to date.');

    if (process.argv.includes('--seed')) {
      for (const s of await sqlFiles(path.join(root, 'seeds'))) {
        process.stdout.write(`  seeding ${s.name} ... `);
        await client.query(s.sql);
        console.log('done');
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => undefined);
    await client.end();
  }
}

main().catch((e: Error) => {
  console.error(`\nMigration failed: ${e.message}`);
  process.exit(1);
});
