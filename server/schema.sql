CREATE TABLE IF NOT EXISTS hr_users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text UNIQUE NOT NULL,
  display_name text NOT NULL,
  password_hash text NOT NULL
);

CREATE TABLE IF NOT EXISTS hr_sessions (
  token_hash text PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES hr_users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS hr_sessions_expiry_idx ON hr_sessions (expires_at);

CREATE TABLE IF NOT EXISTS employees (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_code text UNIQUE NOT NULL,
  display_name text NOT NULL,
  job_title text NOT NULL,
  department text NOT NULL,
  country text NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  salary_minor bigint NOT NULL CHECK (salary_minor BETWEEN 1 AND 100000000000),
  salary_version integer NOT NULL DEFAULT 1 CHECK (salary_version > 0),
  salary_updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS employees_country_department_idx ON employees (country, department);

CREATE TABLE IF NOT EXISTS salary_changes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id integer NOT NULL REFERENCES employees (id),
  actor_id bigint NOT NULL REFERENCES hr_users (id),
  old_salary_minor bigint NOT NULL CHECK (old_salary_minor > 0),
  new_salary_minor bigint NOT NULL CHECK (new_salary_minor > 0),
  currency text NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 5 AND 500),
  changed_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CHECK (old_salary_minor <> new_salary_minor)
);

CREATE INDEX IF NOT EXISTS salary_changes_employee_idx ON salary_changes (employee_id, id DESC);
