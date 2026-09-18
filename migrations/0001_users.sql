-- One account per person, replacing the three shared passwords the dashboard
-- used to gate on (VIEW_*, ADMIN_*, SYNC_PASSWORD).
--
-- `role` is the whole authorisation model: viewer reads the dashboard, editor
-- may also trigger a sync, admin may also approve review records and manage
-- accounts. It is checked against the database on every request rather than
-- trusted from the session cookie, so a demotion takes effect immediately.
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL,
  -- Case-folded copy of username, so logins and uniqueness ignore case without
  -- losing how the person actually writes their own name.
  username_key  TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('viewer', 'editor', 'admin')),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
