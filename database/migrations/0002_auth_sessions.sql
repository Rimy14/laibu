-- 0002_auth_sessions: Sprint 1 (auth + terms gate + payout methods).
-- Mirrored in DATABASE_SCHEMA.sql.

-- Admin sessions live on the separate admin host with shorter lifetimes; a
-- refresh token issued for one audience can never be used for the other.
ALTER TABLE refresh_tokens
  ADD COLUMN audience text NOT NULL DEFAULT 'web' CHECK (audience IN ('web', 'admin'));

-- Lets every session issued before a password change be rejected.
ALTER TABLE users
  ADD COLUMN password_changed_at timestamptz;

-- Superadmins are created only by the server-side script, never by signup.
-- (Role changes are audited; this index makes "list admins" cheap.)
CREATE INDEX users_superadmin_idx ON users (id) WHERE role = 'superadmin';
