import pg from 'pg';
import { createApp } from './app.ts';
import { requireEnv } from './config.ts';

const pool = new pg.Pool({
  connectionString: requireEnv('DATABASE_URL'),
  max: 10,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 5_000,
});
pool.on('error', (error) => console.error('Idle database connection failed', error.message));
const app = createApp(pool, {
  secureCookies: process.env.COOKIE_SECURE === 'true',
  appOrigin: process.env.APP_ORIGIN ?? process.env.RENDER_EXTERNAL_URL,
  trustProxy: process.env.TRUST_PROXY === 'true',
});
const port = Number(process.env.PORT ?? 3000);
const server = app.listen(port, '0.0.0.0', () => console.log(`ACME Salary Manager listening on ${port}`));

function shutdown() {
  server.close(async () => { await pool.end(); });
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
