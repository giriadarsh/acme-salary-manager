# ACME Salary Manager

A Node.js, TypeScript, React, and PostgreSQL take-home for Incubyte. Search ACME’s 10,000 synthetic employees, record a salary change, and see its impact in the compensation report.

## Start in one command

With Docker Engine and the Docker Compose plugin installed, run from the repository root:

```sh
docker compose up --build --wait
```

Open [http://localhost:3000](http://localhost:3000) and use `hr@acme.example` with `acme-demo-2026!`. These credentials are for the local, synthetic demo. The database remains in a named volume across restarts. Use `docker compose down` to stop the services. For a port conflict, set `APP_PORT` in an optional `.env` copied from `.env.example`.

## Reviewer walkthrough

1. Search the employee directory for `AC-00001` and open the record.
2. Change the annual salary, enter a reason, and check that it appears in the salary history with the previous pay and actor.
3. Open **Compensation**, filter to **India** and **Engineering**, and review the INR total and median.
4. Open the same employee in two sessions, begin editing in each, then save a different value in both. The second save reports a conflict and offers to reload.

[Demo video](docs/demo.mp4) · [One-page requirements](REQUIREMENTS.md) · [Design and trade-offs](docs/DESIGN.md) · [AI workflow](docs/AI-WORKFLOW.md) · [Verification](docs/VERIFICATION.md)

## Run outside Docker

Use Node.js 24+ and an existing PostgreSQL 17 database. Set `DATABASE_URL`, `HR_EMAIL`, `HR_PASSWORD` (12 or more characters), and `SEED_DEMO=true` in your shell. Use a fresh database for synthetic data. Then run:

```sh
npm ci
npm run build
npm run db:setup
npm start
```

The app uses port 3000 by default. For separate frontend development, run `npm run server:dev` on port 3000 and `npm run dev` in another shell. The Vite server proxies `/api` to the local backend.

## Verification

```sh
npm test
TEST_DATABASE_URL=postgres://user:password@localhost:5432/acme_test npm run test:db
```

Unit tests cover money parsing, input validation, session token parsing, password verification, and the seed generator. Integration tests exercise real PostgreSQL and the HTTP API. They cover authentication, filtering, reporting, a successful update, audit rollback, conflicting changes, and sign-out. The database user needs permission to create a temporary schema. Integration tests remove only their own schema. The GitHub Actions workflow runs the build, both test suites, and the Docker build.

## Deploy a reviewer demo

1. Push the repository to GitHub. In an authenticated Render workspace, select **New → Blueprint** and choose the repository. The included `render.yaml` defines a Docker web service and managed PostgreSQL database.
2. Supply a unique `HR_PASSWORD` when prompted. The demo account email is `hr@acme.example`. Share the password privately with reviewers. The app seeds its synthetic data on startup and uses secure cookies over HTTPS.
3. Open the service URL, sign in, and perform the walkthrough above. Share that URL, the repository URL, and the demo video in the submission thread.

For another Docker host, build the same `Dockerfile`, configure the above database and HR variables, and set `COOKIE_SECURE=true`, `APP_ORIGIN` to the exact HTTPS origin, and `TRUST_PROXY=true` only when exactly one trusted proxy is in front of the app. `/api/health` is the readiness check.

The free Render setup is for a temporary review. Review the provider’s database retention limits if the demo needs to remain available long term.
