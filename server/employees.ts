import type { Pool } from 'pg';
import type { Employee, EmployeeDetail, EmployeePage, FilterOptions, Report, ReportRow } from '../shared/compensation.ts';
import type { EmployeeFilters, ReportFilters, SalaryInput } from './validation.ts';

const EMPLOYEE_COLUMNS = `id, employee_code AS code, display_name AS name, job_title AS title,
  department, country, currency, salary_minor::float8 AS "salaryMinor",
  salary_version AS version, salary_updated_at AS "updatedAt"`;
const PAGE_SIZE = 20;

export async function listEmployees(pool: Pool, filters: EmployeeFilters): Promise<EmployeePage> {
  const values = [filters.country ?? null, filters.department ?? null, filters.q];
  const filter = `($1::text IS NULL OR country = $1) AND ($2::text IS NULL OR department = $2)
    AND ($3 = '' OR strpos(lower(display_name), lower($3)) > 0
      OR strpos(lower(employee_code), lower($3)) > 0)`;
  const { rows: [result] } = await pool.query<{ total: number; items: Employee[] }>(`WITH matching AS (
    SELECT * FROM employees WHERE ${filter}
  ), page_rows AS (
    SELECT ${EMPLOYEE_COLUMNS} FROM matching ORDER BY id LIMIT $4 OFFSET $5
  ) SELECT (SELECT count(*)::integer FROM matching) AS total,
    COALESCE((SELECT json_agg(p ORDER BY p.id) FROM page_rows p), '[]'::json) AS items`,
  [...values, PAGE_SIZE, (filters.page - 1) * PAGE_SIZE]);
  return { ...result, page: filters.page, pageSize: PAGE_SIZE };
}

export async function getFilterOptions(pool: Pool): Promise<FilterOptions> {
  const { rows: [result] } = await pool.query<FilterOptions>(`SELECT
    COALESCE(array_agg(DISTINCT country ORDER BY country), ARRAY[]::text[]) AS countries,
    COALESCE(array_agg(DISTINCT department ORDER BY department), ARRAY[]::text[]) AS departments
    FROM employees`);
  return result;
}

export async function getEmployee(pool: Pool, id: number) {
  const { rows: [record] } = await pool.query<EmployeeDetail>(`SELECT ${EMPLOYEE_COLUMNS},
    COALESCE((SELECT json_agg(json_build_object(
      'id', c.id::text, 'oldSalaryMinor', c.old_salary_minor, 'newSalaryMinor', c.new_salary_minor,
      'currency', c.currency, 'reason', c.reason, 'actor', u.display_name, 'changedAt', c.changed_at
    ) ORDER BY c.id DESC) FROM salary_changes c JOIN hr_users u ON c.actor_id = u.id
    WHERE c.employee_id = employees.id), '[]'::json) AS history
    FROM employees WHERE id = $1`, [id]);
  return record ?? null;
}

export type SalaryUpdate = { status: 'updated'; employee: Employee } |
  { status: 'missing' | 'conflict' | 'unchanged' };

export async function updateSalary(pool: Pool, id: number, actorId: string, update: SalaryInput): Promise<SalaryUpdate> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [current] } = await client.query<Employee>(`SELECT ${EMPLOYEE_COLUMNS}
      FROM employees WHERE id = $1 FOR UPDATE`, [id]);
    if (!current || current.version !== update.version || current.salaryMinor === update.salaryMinor) {
      await client.query('ROLLBACK');
      if (!current) return { status: 'missing' };
      return { status: current.version !== update.version ? 'conflict' : 'unchanged' };
    }
    const { rows: [employee] } = await client.query<Employee>(`UPDATE employees SET salary_minor = $2,
      salary_version = salary_version + 1, salary_updated_at = transaction_timestamp()
      WHERE id = $1 RETURNING ${EMPLOYEE_COLUMNS}`, [id, update.salaryMinor]);
    await client.query(`INSERT INTO salary_changes (employee_id, actor_id, old_salary_minor,
      new_salary_minor, currency, reason) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, actorId, current.salaryMinor, update.salaryMinor, current.currency, update.reason]);
    await client.query('COMMIT');
    return { status: 'updated', employee };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function compensationReport(pool: Pool, filters: ReportFilters): Promise<Report> {
  const { rows } = await pool.query<ReportRow>(`SELECT country, department, currency,
    count(*)::integer AS count, sum(salary_minor)::float8 AS "totalMinor",
    round((percentile_cont(0.5) WITHIN GROUP (ORDER BY salary_minor))::numeric)::float8 AS "medianMinor"
    FROM employees
    WHERE ($1::text IS NULL OR country = $1) AND ($2::text IS NULL OR department = $2)
    GROUP BY GROUPING SETS ((currency), (country, department, currency))
    ORDER BY country NULLS FIRST, department, currency`, [filters.country ?? null, filters.department ?? null]);
  return { totals: rows.filter(row => row.country === null), groups: rows.filter(row => row.country !== null) };
}
