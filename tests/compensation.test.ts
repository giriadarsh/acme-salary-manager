import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_SALARY_MINOR, parseSalaryMinor } from '../shared/compensation.ts';
import { readSession, SESSION_COOKIE, hashPassword, verifyPassword } from '../server/auth.ts';
import { employeeFilters, loginInput, salaryInput } from '../server/validation.ts';
import { createEmployees } from '../server/seed.ts';

test('converts decimal salary input to exact integer minor units', () => {
  assert.equal(parseSalaryMinor(' 120001.01 '), 12_000_101);
  assert.equal(parseSalaryMinor('0.1'), 10);
  assert.equal(parseSalaryMinor('47'), 4_700);
  assert.equal(parseSalaryMinor('1000000000.00'), MAX_SALARY_MINOR);
});

test('rejects empty values, zero, negatives, excess precision, exponent notation and overflow', () => {
  for (const input of ['', '0', '0.00', '-1', '0.001', '1e5', '1,000.00', '1000000000.01', '2.']) {
    assert.equal(parseSalaryMinor(input), null, `Expected rejection of ${JSON.stringify(input)}`);
  }
});

test('validates the server salary amount, version and reason independently of the browser', () => {
  const valid = { salaryMinor: 12345, version: 1, reason: '  Market alignment  ' };
  assert.deepEqual(salaryInput.parse(valid), { ...valid, reason: 'Market alignment' });
  for (const invalid of [{ salaryMinor: 0 }, { salaryMinor: 1.1 }, { salaryMinor: MAX_SALARY_MINOR + 1 },
    { salaryMinor: '1000' }, { version: 0 }, { reason: '    ' }, { reason: 'x'.repeat(501) }, { currency: 'USD' }]) {
    assert.equal(salaryInput.safeParse({ ...valid, ...invalid }).success, false);
  }
});

test('normalizes known search values and rejects invalid pagination and repeated query parameters', () => {
  assert.deepEqual(employeeFilters.parse({ q: '  AC-01 ', country: 'in' }), { q: 'AC-01', country: 'IN', page: 1 });
  assert.equal(employeeFilters.parse({ page: '20' }).page, 20);
  for (const page of ['0', '-1', '2.5', 'Infinity', '100001', ['1', '2']]) {
    assert.equal(employeeFilters.safeParse({ page }).success, false);
  }
});

test('extracts only a well-formed session token from cookies', () => {
  const token = 'a'.repeat(64);
  assert.equal(readSession(`prefs=1; ${SESSION_COOKIE}=${token}; other=2`), token);
  assert.equal(readSession(`${SESSION_COOKIE}=bad`), undefined);
  assert.equal(readSession(`fake_${SESSION_COOKIE}=${token}`), undefined);
  assert.equal(readSession(), undefined);
});

test('normalizes login email and verifies the original password against the stored digest', async () => {
  assert.equal(loginInput.parse({ email: ' HR@example.com ', password: 'example' }).email, 'hr@example.com');
  const password = 'a strong test credential';
  const digest = await hashPassword(password);
  assert.equal(await verifyPassword(password, digest), true);
  assert.equal(await verifyPassword('another credential', digest), false);
});

test('seed generates 10,000 repeatable, unique employee codes with valid salaries and supported currencies', () => {
  const records = createEmployees();
  assert.equal(records.length, 10_000);
  assert.equal(new Set(records.map(record => record.employee_code)).size, records.length);
  assert.equal(new Set(records.map(record => record.display_name)).size, records.length);
  assert.equal(new Set(records.map(record => record.country)).size, 6);
  assert.ok(records.every(record => Number.isSafeInteger(record.salary_minor) && record.salary_minor > 0));
  assert.deepEqual(records.slice(0, 4), createEmployees(4));
});
