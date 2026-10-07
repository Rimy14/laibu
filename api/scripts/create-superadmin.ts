/**
 * Creates (or resets the password of) the superadmin. There is no other way
 * to get a superadmin account: public signup only allows author, publisher
 * and buyer.
 *
 *   SUPERADMIN_EMAIL=... SUPERADMIN_NAME="..." SUPERADMIN_PASSWORD=... npm run admin:create
 *
 * Pass the password through the environment for this one command only. Don't
 * leave it in .env or shell history; change it after first sign-in.
 */
import pg from 'pg';
import { hashPassword, passwordProblem } from '../src/auth/password.js';
import { cleanEmail, cleanName } from '../src/auth/users.js';

async function main() {
  const email = cleanEmail(process.env.SUPERADMIN_EMAIL ?? '');
  const name = cleanName(process.env.SUPERADMIN_NAME ?? '');
  const password = process.env.SUPERADMIN_PASSWORD ?? '';
  if (!email.includes('@') || name.length < 2) throw new Error('Set SUPERADMIN_EMAIL and SUPERADMIN_NAME.');

  // Admin passwords get a stricter minimum than the public one.
  if (password.length < 14) throw new Error('SUPERADMIN_PASSWORD must be at least 14 characters.');
  const problem = passwordProblem(password, { email, fullName: name });
  if (problem) throw new Error(`SUPERADMIN_PASSWORD: ${problem}`);

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const existing = await client.query<{ id: string; role: string }>('SELECT id, role FROM users WHERE lower(email) = $1', [email]);
    if (existing.rows[0] && existing.rows[0].role !== 'superadmin') {
      throw new Error('That email belongs to a non-admin account. Use a separate email for the admin.');
    }
    const hash = await hashPassword(password);
    await client.query('BEGIN');
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO users (role, full_name, email, password_hash, password_changed_at)
       VALUES ('superadmin', $1, $2, $3, now())
       ON CONFLICT ((lower(email))) DO UPDATE
         SET password_hash = EXCLUDED.password_hash, password_changed_at = now(),
             full_name = EXCLUDED.full_name, failed_login_count = 0, locked_until = NULL
       RETURNING id`,
      [name, email, hash],
    );
    const id = rows[0].id;
    // A reset ends every existing admin session.
    await client.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [id]);
    await client.query(
      `INSERT INTO user_terms_acceptances (user_id, terms_version_id)
       SELECT $1, id FROM terms_versions WHERE is_current ON CONFLICT DO NOTHING`,
      [id],
    );
    await client.query(
      `INSERT INTO audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata)
       VALUES ($1::uuid, 'superadmin', $2, 'user', $1::text, '{"via":"create-superadmin script"}')`,
      [id, existing.rows[0] ? 'superadmin.password_reset' : 'superadmin.create'],
    );
    await client.query('COMMIT');
    console.log(`${existing.rows[0] ? 'Reset' : 'Created'} superadmin ${email}. Sign in at the admin address.`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
