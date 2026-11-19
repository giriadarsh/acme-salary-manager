import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { CookieOptions, ErrorRequestHandler, RequestHandler } from 'express';
import type { Pool } from 'pg';
import type { HrUser } from '../shared/compensation.ts';
import { createSession, readSession, revokeSession, sessionUser, SESSION_COOKIE, SESSION_MAX_AGE } from './auth.ts';
import { compensationReport, getEmployee, getFilterOptions, listEmployees, updateSalary } from './employees.ts';
import { employeeFilters, employeeId, loginInput, reportFilters, salaryInput } from './validation.ts';

const clientPath = fileURLToPath(new URL('../dist/', import.meta.url));

type AppOptions = { secureCookies?: boolean; appOrigin?: string; trustProxy?: boolean };

function limitLoginAttempts(): RequestHandler {
  const windowMs = 15 * 60 * 1000;
  let resetAt = Date.now() + windowMs;
  const attempts = new Map<string, number>();
  return (req, res, next) => {
    if (Date.now() >= resetAt) {
      attempts.clear();
      resetAt = Date.now() + windowMs;
    }
    const ip = req.ip ?? 'unknown';
    const count = attempts.get(ip) ?? 0;
    if (count >= 30 || (!attempts.has(ip) && attempts.size >= 10_000)) {
      res.set('Retry-After', String(Math.ceil((resetAt - Date.now()) / 1000)));
      res.status(429).json({ message: 'Too many sign-in attempts. Please try again later.' });
      return;
    }
    attempts.set(ip, count + 1);
    next();
  };
}

export function createApp(pool: Pool, options: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (options.trustProxy) app.set('trust proxy', 1);
  const cookie: CookieOptions = { httpOnly: true, sameSite: 'lax', secure: options.secureCookies ?? false, path: '/' };
  const api = express.Router();
  app.use((_req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' });
    next();
  });
  app.use('/api', api);
  api.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (['POST', 'PATCH'].includes(req.method)) {
      const origin = req.get('origin');
      const expectedOrigin = options.appOrigin ?? `${req.protocol}://${req.get('host')}`;
      if (origin && origin !== expectedOrigin) {
        res.status(403).json({ message: 'This request came from another origin.' });
        return;
      }
      if (!req.is('application/json')) {
        res.status(415).json({ message: 'Send the request as application/json.' });
        return;
      }
    }
    next();
  });
  api.use(express.json({ limit: '8kb' }));

  api.get('/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  api.post('/auth/login', limitLoginAttempts(), async (req, res) => {
    const input = loginInput.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ message: 'Enter a valid email and password.' });
      return;
    }
    const session = await createSession(pool, input.data.email, input.data.password);
    if (!session) {
      res.status(401).json({ message: 'Email or password is incorrect.' });
      return;
    }
    await revokeSession(pool, readSession(req.headers.cookie));
    res.cookie(SESSION_COOKIE, session.token, { ...cookie, maxAge: SESSION_MAX_AGE }).json(session.user);
  });
  api.post('/auth/logout', async (req, res) => {
    await revokeSession(pool, readSession(req.headers.cookie));
    res.clearCookie(SESSION_COOKIE, cookie).status(204).end();
  });

  api.use(async (req, res, next) => {
    const user = await sessionUser(pool, readSession(req.headers.cookie));
    if (!user) {
      res.status(401).json({ message: 'Sign in to continue.' });
      return;
    }
    res.locals.user = user;
    next();
  });
  api.get('/auth/me', (_req, res) => { res.json(res.locals.user); });
  api.get('/filters', async (_req, res) => { res.json(await getFilterOptions(pool)); });

  api.get('/employees', async (req, res) => {
    const filters = employeeFilters.safeParse(req.query);
    if (!filters.success) {
      res.status(400).json({ message: 'Check your search filters and page number.' });
      return;
    }
    res.json(await listEmployees(pool, filters.data));
  });
  api.get('/employees/:id', async (req, res) => {
    const id = employeeId.safeParse(req.params.id);
    const record = id.success ? await getEmployee(pool, id.data) : null;
    if (!record) {
      res.status(404).json({ message: 'Employee could not be found.' });
      return;
    }
    res.json(record);
  });
  api.patch('/employees/:id/salary', async (req, res) => {
    const id = employeeId.safeParse(req.params.id);
    const input = salaryInput.safeParse(req.body);
    if (!id.success) {
      res.status(404).json({ message: 'Employee could not be found.' });
      return;
    }
    if (!input.success) {
      res.status(400).json({ message: 'Enter a valid salary and a reason between 5 and 500 characters.' });
      return;
    }
    const user = res.locals.user as HrUser;
    const result = await updateSalary(pool, id.data, user.id, input.data);
    if (result.status === 'updated') { res.json(result.employee); return; }
    if (result.status === 'missing') { res.status(404).json({ message: 'Employee could not be found.' }); return; }
    if (result.status === 'conflict') {
      res.status(409).json({ message: 'Someone updated this salary. Reload the latest amount and review your change.' });
      return;
    }
    res.status(422).json({ message: 'Enter an amount different from the current salary.' });
  });
  api.get('/compensation', async (req, res) => {
    const filters = reportFilters.safeParse(req.query);
    if (!filters.success) {
      res.status(400).json({ message: 'Check the country and department filters.' });
      return;
    }
    res.json(await compensationReport(pool, filters.data));
  });
  api.use((_req, res) => { res.status(404).json({ message: 'API route could not be found.' }); });

  if (existsSync(clientPath)) app.use(express.static(clientPath));

  const handleError: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) { next(error); return; }
    if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
      res.status(error.status).json({ message: 'The request body is invalid or too large.' });
      return;
    }
    console.error('Request failed', { name: error.name, code: error.code });
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  };
  app.use(handleError);
  return app;
}
