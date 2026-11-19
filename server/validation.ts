import { z } from 'zod';
import { MAX_SALARY_MINOR } from '../shared/compensation.ts';

const country = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/);
const department = z.string().trim().min(1).max(60);
const positiveInt = z.string().regex(/^[1-9][0-9]*$/).transform(Number)
  .pipe(z.number().int().min(1).max(2_147_483_647));

export const employeeId = positiveInt;
export const employeeFilters = z.object({
  q: z.string().trim().max(120).default(''),
  country: country.optional(),
  department: department.optional(),
  page: positiveInt.pipe(z.number().max(100_000)).default(1),
});
export const reportFilters = z.object({ country: country.optional(), department: department.optional() });
export const salaryInput = z.strictObject({
  salaryMinor: z.number().int().min(1).max(MAX_SALARY_MINOR),
  version: z.number().int().min(1).max(2_147_483_647),
  reason: z.string().trim().min(5, 'Enter a reason of at least five characters.').max(500),
});
export const loginInput = z.strictObject({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

export type SalaryInput = z.infer<typeof salaryInput>;
export type EmployeeFilters = z.infer<typeof employeeFilters>;
export type ReportFilters = z.infer<typeof reportFilters>;
