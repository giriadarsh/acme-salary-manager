import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { hashPassword } from './auth.ts';
import { requireEnv } from './config.ts';
import { createEmployees } from './seed.ts';

const pool = new pg.Pool({ connectionString: requireEnv('DATABASE_URL') });
const client = await pool.connect();
try {
  const email = requireEnv('HR_EMAIL').trim().toLowerCase();
  const password = requireEnv('HR_PASSWORD');
  if (password.length < 12) throw new Error('HR_PASSWORD must have at least 12 characters');
  const passwordHash = await hashPassword(password);
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(17425)');
  await client.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
  await client.query(`INSERT INTO hr_users (email, display_name, password_hash)
    VALUES ($1, 'HR Manager', $2) ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash`, [email, passwordHash]);
  const { rows: [{ count }] } = await client.query<{count: number}>('SELECT count(*)::integer AS count FROM employees');
  if (count === 0 && process.env.SEED_DEMO === 'true') {
    await client.query(`INSERT INTO employees
      (employee_code, display_name, job_title, department, country, currency, salary_minor)
      SELECT employee_code, display_name, job_title, department, country, currency, salary_minor
      FROM jsonb_to_recordset($1::jsonb) AS seed(employee_code text, display_name text,
        job_title text, department text, country text, currency text, salary_minor bigint)`,
    [JSON.stringify(createEmployees())]);
    console.log('Seeded 10,000 synthetic employees.');
  }
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
