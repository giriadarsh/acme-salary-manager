// Every supported demo currency uses two minor-unit digits.
export const MAX_SALARY_MINOR = 100_000_000_000;
export const MAX_SALARY_MAJOR = MAX_SALARY_MINOR / 100;

export function parseSalaryMinor(value: string): number | null {
  const match = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const minor = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return minor > 0 && minor <= MAX_SALARY_MINOR ? minor : null;
}

export type Employee = {
  id: number;
  code: string;
  name: string;
  title: string;
  department: string;
  country: string;
  currency: string;
  salaryMinor: number;
  version: number;
  updatedAt: string | null;
};

export type SalaryChange = {
  id: string;
  oldSalaryMinor: number;
  newSalaryMinor: number;
  currency: string;
  reason: string;
  actor: string;
  changedAt: string;
};

export type EmployeeDetail = Employee & { history: SalaryChange[] };
export type EmployeePage = { items: Employee[]; total: number; page: number; pageSize: number };
export type Filters = { country: string; department: string };
export type FilterOptions = { countries: string[]; departments: string[] };
export type HrUser = { id: string; name: string; email: string };
export type ReportRow = {
  country: string | null;
  department: string | null;
  currency: string;
  count: number;
  totalMinor: number;
  medianMinor: number;
};
export type Report = { totals: ReportRow[]; groups: ReportRow[] };
