CREATE TABLE IF NOT EXISTS supervisors (
  id            serial PRIMARY KEY,
  username      text UNIQUE NOT NULL,
  display_name  text NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash    text PRIMARY KEY,
  supervisor_id int NOT NULL REFERENCES supervisors ON DELETE CASCADE,
  expires_at    timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  id              bigserial PRIMARY KEY,
  course_slug     text NOT NULL,
  course_title    text NOT NULL,
  instructor_slug text NOT NULL,
  instructor_name text NOT NULL,
  phone           text NOT NULL,
  message         text NOT NULL,
  status          text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'done')),
  note            text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      int REFERENCES supervisors ON DELETE SET NULL
);

-- Added after the first release; existing rows get empty values
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS first_name  text NOT NULL DEFAULT '';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS last_name   text NOT NULL DEFAULT '';
-- National ID (کد ملی) is no longer collected; drop it along with any stored values
ALTER TABLE tickets DROP COLUMN IF EXISTS national_id;

-- Consultation requests share the tickets table; they leave course/instructor empty
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'course_request'
  CHECK (kind IN ('course_request', 'consultation'));
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS company text NOT NULL DEFAULT '';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assigned_to int REFERENCES supervisors ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tickets_status_created_idx ON tickets (status, created_at DESC);
CREATE INDEX IF NOT EXISTS tickets_created_idx ON tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS tickets_assigned_idx ON tickets (assigned_to);

-- Supervisor roles; the oldest account becomes admin if there is none yet
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'supervisor'
  CHECK (role IN ('admin', 'supervisor'));
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
UPDATE supervisors SET role = 'admin'
  WHERE id = (SELECT min(id) FROM supervisors)
    AND NOT EXISTS (SELECT 1 FROM supervisors WHERE role = 'admin');

-- One row per field a supervisor changed on a ticket
CREATE TABLE IF NOT EXISTS ticket_events (
  id            bigserial PRIMARY KEY,
  ticket_id     bigint NOT NULL REFERENCES tickets ON DELETE CASCADE,
  supervisor_id int REFERENCES supervisors ON DELETE SET NULL,
  field         text NOT NULL CHECK (field IN ('status', 'note', 'assigned_to')),
  old_value     text,
  new_value     text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ticket_events_ticket_idx ON ticket_events (ticket_id, created_at);

-- Scheduled sessions of each course; numbered by starts_at order
CREATE TABLE IF NOT EXISTS course_sessions (
  id          bigserial PRIMARY KEY,
  course_slug text NOT NULL,
  starts_at   timestamptz NOT NULL,
  title       text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS course_sessions_course_idx ON course_sessions (course_slug, starts_at);

-- کد پیگیری: TR- + 6 characters without look-alikes (0/O, 1/I).
-- The volatile default also gives every existing row its own code when the column is added.
CREATE OR REPLACE FUNCTION tara_tracking_code() RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT 'TR-' || string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  FROM generate_series(1, 6)
$$;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS tracking_code text NOT NULL DEFAULT tara_tracking_code();
CREATE UNIQUE INDEX IF NOT EXISTS tickets_tracking_code_idx ON tickets (tracking_code);

-- Public form submissions per IP, for rate limiting; rows older than an hour are pruned on insert
CREATE TABLE IF NOT EXISTS form_submissions (
  ip         inet NOT NULL,
  form       text NOT NULL CHECK (form IN ('course_request', 'consultation')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS form_submissions_ip_idx ON form_submissions (ip, form, created_at);
