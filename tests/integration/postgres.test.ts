import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import pg from 'pg';
import type { Employee, EmployeeDetail, EmployeePage, Report } from '../../shared/compensation.ts';
import { createApp } from '../../server/app.ts';
import { hashPassword } from '../../server/auth.ts';
import { updateSalary } from '../../server/employees.ts';

const database = process.env.TEST_DATABASE_URL;
if (!database) throw new Error('Set TEST_DATABASE_URL to a PostgreSQL instance with CREATE SCHEMA permission.');
const schema = `acme_test_${randomBytes(8).toString('hex')}`;
const admin = new pg.Pool({ connectionString: database });
const pool = new pg.Pool({ connectionString: database, options: `-c search_path=${schema}` });
const password = 'test-reviewer-credential';
const email = 'hr@example.test';
let server: Server | undefined;
let root: string;
let cookie: string;
let createdSchema = false;

async function request(path: string, options: { method?: string; body?: unknown; cookie?: string; origin?: string } = {}) {
  const headers = new Headers();
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.cookie) headers.set('Cookie', options.cookie);
  if (options.origin) headers.set('Origin', options.origin);
  return fetch(`${root}/api${path}`, { method: options.method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
}

before(async () => {
  await admin.query(`CREATE SCHEMA ${schema}`);
  createdSchema = true;
  await pool.query(await readFile(new URL('../../server/schema.sql', import.meta.url), 'utf8'));
  await pool.query('INSERT INTO hr_users (email, display_name, password_hash) VALUES ($1, $2, $3)',
    [email, 'Test HR Manager', await hashPassword(password)]);
  await pool.query(`INSERT INTO employees (employee_code, display_name, job_title, department, country, currency, salary_minor)
    VALUES ('AC-00001', 'Aarav Rao', 'Analyst', 'Operations', 'IN', 'INR', 10001),
           ('AC-00002', 'Maya Das', 'Analyst', 'Operations', 'IN', 'INR', 20000),
           ('AC-00003', 'Jordan Smith', 'Engineer', 'Engineering', 'US', 'USD', 40000),
           ('AC-00004', 'Priya Patel', 'Engineer', 'Engineering', 'IN', 'INR', 80000)`);
  server = createApp(pool).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  root = `http://127.0.0.1:${address.port}`;
  const signIn = await request('/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(signIn.status, 200);
  const setCookie = signIn.headers.get('set-cookie');
  assert.ok(setCookie);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  cookie = setCookie.split(';')[0];
});

after(async () => {
  server?.close();
  await pool.end();
  try { if (createdSchema) await admin.query(`DROP SCHEMA ${schema} CASCADE`); }
  finally { await admin.end(); }
});

test('salary reads and writes require a session, and writes from another origin are rejected', async () => {
  assert.equal((await request('/employees')).status, 401);
  assert.equal((await request('/employees/1/salary', { method: 'PATCH', body: {} })).status, 401);
  assert.equal((await request('/employees/1/salary', { method: 'PATCH', body: {}, origin: 'https://example.test', cookie })).status, 403);
});

test('employee directory searches literal text and filters country and department', async () => {
  const response = await request('/employees?q=aarav&country=IN&department=Operations', { cookie });
  assert.equal(response.status, 200);
  const data: EmployeePage = await response.json();
  assert.equal(data.total, 1);
  assert.equal(data.items[0].code, 'AC-00001');
  const wildcard: EmployeePage = await (await request('/employees?q=%25', { cookie })).json();
  assert.equal(wildcard.total, 0);
  assert.equal((await request('/employees?page=0', { cookie })).status, 400);
});

test('reports split currencies and round an even-size median to the nearest minor unit', async () => {
  const report: Report = await (await request('/compensation', { cookie })).json();
  assert.deepEqual(report.totals.map(row => [row.currency, row.totalMinor, row.medianMinor]),
    [['INR', 110001, 20000], ['USD', 40000, 40000]]);
  const operations: Report = await (await request('/compensation?country=IN&department=Operations', { cookie })).json();
  assert.deepEqual(operations.totals.map(row => [row.count, row.totalMinor, row.medianMinor]), [[2, 30001, 15001]]);
});

test('salary update records the actor and reason, and increments the filtered report total', async () => {
  const update = await request('/employees/1/salary', { method: 'PATCH', cookie,
    body: { salaryMinor: 30001, version: 1, reason: 'Annual pay review' } });
  assert.equal(update.status, 200);
  const updated: Employee = await update.json();
  assert.equal(updated.version, 2);
  const detail: EmployeeDetail = await (await request('/employees/1', { cookie })).json();
  assert.equal(detail.history.length, 1);
  assert.equal(detail.history[0].oldSalaryMinor, 10001);
  assert.equal(detail.history[0].newSalaryMinor, detail.salaryMinor);
  assert.equal(detail.history[0].reason, 'Annual pay review');
  assert.equal(detail.history[0].actor, 'Test HR Manager');
  const report: Report = await (await request('/compensation?country=IN&department=Operations', { cookie })).json();
  assert.equal(report.totals[0].totalMinor, 50001);
});

test('a failed audit insert rolls back the new salary and version', async () => {
  await assert.rejects(updateSalary(pool, 2, '99999999', { salaryMinor: 70000, version: 1, reason: 'Audit rollback test' }),
    { code: '23503' });
  const detail: EmployeeDetail = await (await request('/employees/2', { cookie })).json();
  assert.equal(detail.salaryMinor, 20000);
  assert.equal(detail.version, 1);
  assert.deepEqual(detail.history, []);
});

test('concurrent edits based on one version produce one save and one conflict', async () => {
  const changes = await Promise.all([70000, 72000].map(salaryMinor => request('/employees/3/salary', {
    method: 'PATCH', cookie, body: { salaryMinor, version: 1, reason: 'Compensation adjustment' },
  })));
  assert.deepEqual(changes.map(response => response.status).sort(), [200, 409]);
  const detail: EmployeeDetail = await (await request('/employees/3', { cookie })).json();
  assert.equal(detail.version, 2);
  assert.equal(detail.history.length, 1);
  assert.equal(detail.history[0].newSalaryMinor, detail.salaryMinor);
});

test('invalid and no-op updates preserve salary and history', async () => {
  const invalid = await request('/employees/4/salary', { method: 'PATCH', cookie,
    body: { salaryMinor: 80001, version: 1, reason: '' } });
  assert.equal(invalid.status, 400);
  const noOp = await request('/employees/4/salary', { method: 'PATCH', cookie,
    body: { salaryMinor: 80000, version: 1, reason: 'No change intended' } });
  assert.equal(noOp.status, 422);
  const detail: EmployeeDetail = await (await request('/employees/4', { cookie })).json();
  assert.equal(detail.version, 1);
  assert.equal(detail.history.length, 0);
});

test('sign-out revokes the database session', async () => {
  assert.equal((await request('/auth/logout', { method: 'POST', cookie, body: {} })).status, 204);
  assert.equal((await request('/auth/me', { cookie })).status, 401);
});
