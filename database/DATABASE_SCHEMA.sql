-- =====================================================================
-- LAIBU — DATABASE SCHEMA (source of truth)
-- PostgreSQL 15+ · TZ = Africa/Nairobi
--
-- Written from DEVELOPER_DOCUMENTATION v1.0 (Oct 2026). Section refs (§)
-- point to that document. Migrations in database/migrations are generated
-- from this file; change this file first.
--
-- Security notes
--   * Money: NUMERIC(12,2) in KES. Never floats.
--   * Account numbers / M-Pesa phones are stored ENCRYPTED (bytea, AES-256-GCM
--     done in the API with a key from env/KMS). Only *_last4 is plaintext.
--   * Per-book DRM keys are NEVER stored here — books.key_ref points into
--     the KMS / secret store (§6, §10).
--   * sales_ledger, audit_log and user_terms_acceptances are append-only,
--     enforced by triggers below (§9, §10).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), digest()

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
CREATE TYPE user_role          AS ENUM ('author', 'publisher', 'buyer', 'superadmin');
CREATE TYPE user_status        AS ENUM ('active', 'suspended');
CREATE TYPE terms_doc          AS ENUM ('terms_of_use', 'privacy_policy');
CREATE TYPE payout_method_type AS ENUM ('mpesa', 'bank');

-- §4 book status machine
CREATE TYPE book_status AS ENUM (
  'draft', 'pending_author', 'declined_by_author',
  'pending_admin', 'rejected', 'live', 'delisted'
);
CREATE TYPE drm_status       AS ENUM ('pending', 'processing', 'processed', 'failed');
CREATE TYPE book_format      AS ENUM ('pdf', 'epub', 'docx', 'html');

CREATE TYPE approval_kind    AS ENUM ('new_book', 'sell_request');
CREATE TYPE approval_stage   AS ENUM ('author', 'superadmin');
CREATE TYPE approval_status  AS ENUM ('pending', 'approved', 'declined', 'expired');

CREATE TYPE order_status     AS ENUM ('pending', 'paid', 'failed', 'cancelled');
CREATE TYPE ledger_entry     AS ENUM ('sale', 'reversal');

CREATE TYPE payout_cycle_status AS ENUM ('upcoming', 'generated', 'completed');
CREATE TYPE payout_line_status  AS ENUM ('pending', 'held', 'paid');
CREATE TYPE payee_role          AS ENUM ('author', 'publisher', 'owner');

CREATE TYPE security_event_type AS ENUM (
  'screenshot_key', 'window_blur', 'tab_hidden', 'devtools_open',
  'print_attempt', 'copy_attempt', 'context_menu'
);

-- ---------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION forbid_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% on % is not allowed (append-only table)', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END $$ LANGUAGE plpgsql;

-- Name comparison used by the §2.6 name-match rule (case/space-insensitive).
CREATE OR REPLACE FUNCTION normalize_name(n text) RETURNS text AS $$
  SELECT lower(regexp_replace(btrim(coalesce(n, '')), '\s+', ' ', 'g'))
$$ LANGUAGE sql IMMUTABLE;

-- =====================================================================
-- 1. USERS & SESSIONS  (§5.1, §10)
-- =====================================================================
CREATE TABLE users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role                user_role    NOT NULL,
  full_name           text         NOT NULL CHECK (length(btrim(full_name)) BETWEEN 2 AND 120),
  email               text         NOT NULL CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone               text,
  password_hash       text         NOT NULL,                -- argon2id
  status              user_status  NOT NULL DEFAULT 'active',
  email_verified_at   timestamptz,
  -- §2.4 author room
  room_unlocked       boolean      NOT NULL DEFAULT false,
  room_slug           text         UNIQUE,
  bio                 text,
  -- brute-force protection
  failed_login_count  integer      NOT NULL DEFAULT 0,
  locked_until        timestamptz,
  last_login_at       timestamptz,
  password_changed_at timestamptz,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));
CREATE INDEX users_role_idx ON users (role);
CREATE INDEX users_superadmin_idx ON users (id) WHERE role = 'superadmin';
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Refresh-token rotation with reuse detection (§10).
-- A token is single-use; presenting a revoked token revokes its whole family.
CREATE TABLE refresh_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id    uuid        NOT NULL,
  token_hash   text        NOT NULL UNIQUE,                 -- sha256, never the raw token
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  replaced_by  uuid        REFERENCES refresh_tokens(id),
  audience     text        NOT NULL DEFAULT 'web' CHECK (audience IN ('web', 'admin')),
  ip           inet,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx   ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_family_idx ON refresh_tokens (family_id);

-- =====================================================================
-- 2. TERMS ACCEPTANCE GATE  (§9)
-- =====================================================================
CREATE TABLE terms_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc           terms_doc   NOT NULL,
  version       text        NOT NULL,
  title         text        NOT NULL,
  content_md    text        NOT NULL,
  is_current    boolean     NOT NULL DEFAULT false,
  published_at  timestamptz NOT NULL DEFAULT now(),
  created_by    uuid        REFERENCES users(id),
  UNIQUE (doc, version)
);
-- exactly one current version per document
CREATE UNIQUE INDEX terms_versions_one_current ON terms_versions (doc) WHERE is_current;

-- Contract evidence (Terms §1). Never deleted; retain 7 years.
CREATE TABLE user_terms_acceptances (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  terms_version_id  uuid        NOT NULL REFERENCES terms_versions(id) ON DELETE RESTRICT,
  accepted_at       timestamptz NOT NULL DEFAULT now(),
  ip                inet,
  user_agent        text,
  UNIQUE (user_id, terms_version_id)
);
CREATE INDEX uta_user_idx ON user_terms_acceptances (user_id);
CREATE TRIGGER uta_append_only BEFORE UPDATE OR DELETE ON user_terms_acceptances
  FOR EACH ROW EXECUTE FUNCTION forbid_change();

-- =====================================================================
-- 3. PAYOUT METHODS  (§2.6)
--   Authors: M-Pesa or bank. Publishers: bank only. Superadmin: either.
--   account_name must match users.full_name (enforced here AND in the API).
-- =====================================================================
CREATE TABLE payout_methods (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  type               payout_method_type NOT NULL,
  account_name       text        NOT NULL,
  -- M-Pesa
  mpesa_phone_enc    bytea,
  -- Bank
  bank_name          text,
  bank_branch        text,
  bank_account_enc   bytea,
  -- display only
  account_last4      text        NOT NULL CHECK (account_last4 ~ '^[0-9]{2,4}$'),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (type = 'mpesa' AND mpesa_phone_enc IS NOT NULL AND bank_account_enc IS NULL)
    OR
    (type = 'bank'  AND bank_account_enc IS NOT NULL AND bank_name IS NOT NULL AND mpesa_phone_enc IS NULL)
  )
);
CREATE TRIGGER payout_methods_updated_at BEFORE UPDATE ON payout_methods
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION payout_method_rules() RETURNS trigger AS $$
DECLARE u users%ROWTYPE;
BEGIN
  SELECT * INTO u FROM users WHERE id = NEW.user_id;
  IF u.role = 'buyer' THEN
    RAISE EXCEPTION 'buyers cannot have payout methods' USING ERRCODE = 'check_violation';
  END IF;
  IF u.role = 'publisher' AND NEW.type <> 'bank' THEN
    RAISE EXCEPTION 'publishers must use a bank payout method' USING ERRCODE = 'check_violation';
  END IF;
  IF normalize_name(NEW.account_name) <> normalize_name(u.full_name) THEN
    RAISE EXCEPTION 'payout account name must match the account holder name'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER payout_methods_rules BEFORE INSERT OR UPDATE ON payout_methods
  FOR EACH ROW EXECUTE FUNCTION payout_method_rules();

-- =====================================================================
-- 4. BOOKS  (§2.3, §4, §6)
-- =====================================================================
CREATE TABLE books (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id             uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  publisher_id          uuid        REFERENCES users(id) ON DELETE RESTRICT,
  created_by            uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_superadmin_book    boolean     NOT NULL DEFAULT false,

  title                 text        NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  slug                  text        NOT NULL UNIQUE,
  subtitle              text,
  description           text,
  language              text        NOT NULL DEFAULT 'en',
  category              text,
  page_count            integer     CHECK (page_count IS NULL OR page_count > 0),
  price_kes             numeric(12,2) NOT NULL CHECK (price_kes >= 0),
  -- §2.2: set by publisher at setup, accepted by author. NULL for direct books.
  author_royalty_pct    numeric(5,2) CHECK (author_royalty_pct IS NULL OR author_royalty_pct BETWEEN 0 AND 100),

  status                book_status NOT NULL DEFAULT 'draft',
  drm_status            drm_status  NOT NULL DEFAULT 'pending',
  file_format           book_format,
  file_size_bytes       bigint      CHECK (file_size_bytes IS NULL OR file_size_bytes > 0),
  file_sha256           text,
  raw_object_key        text,       -- private bucket; deleted after DRM succeeds
  encrypted_object_key  text,       -- AES-256 blob
  key_ref               text,       -- KMS / secret-store reference to K_book (never the key)
  cover_object_key      text,
  virus_scanned_at      timestamptz,

  review_notes          text,       -- superadmin rejection / fix notes
  live_at               timestamptz,
  delisted_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CHECK (publisher_id IS NULL OR author_royalty_pct IS NOT NULL),
  CHECK (status <> 'live' OR (live_at IS NOT NULL AND drm_status = 'processed'))
);
CREATE INDEX books_status_idx     ON books (status);
CREATE INDEX books_author_idx     ON books (author_id);
CREATE INDEX books_publisher_idx  ON books (publisher_id);
CREATE INDEX books_storefront_idx ON books (is_superadmin_book DESC, live_at DESC) WHERE status = 'live';
CREATE TRIGGER books_updated_at BEFORE UPDATE ON books
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- §2.4: author room unlocks automatically at 2 live books.
CREATE OR REPLACE FUNCTION refresh_room_unlock() RETURNS trigger AS $$
BEGIN
  UPDATE users u
     SET room_unlocked = (SELECT count(*) >= 2 FROM books b
                           WHERE b.author_id = u.id AND b.status = 'live')
   WHERE u.id = NEW.author_id
     AND u.role = 'author';
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER books_room_unlock AFTER INSERT OR UPDATE OF status ON books
  FOR EACH ROW EXECUTE FUNCTION refresh_room_unlock();

-- =====================================================================
-- 5. APPROVALS  (§2.3, §5.3, §8)
--   Tokens: HMAC-SHA256(book_id + author_id + nonce); only the hash is stored.
--   14-day expiry, single-use, idempotent.
-- =====================================================================
CREATE TABLE approvals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id               uuid        NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
  kind                  approval_kind   NOT NULL DEFAULT 'new_book',
  stage                 approval_stage  NOT NULL,
  status                approval_status NOT NULL DEFAULT 'pending',
  publisher_id          uuid        REFERENCES users(id),
  author_email          text,                       -- where the request was sent
  proposed_royalty_pct  numeric(5,2) CHECK (proposed_royalty_pct IS NULL OR proposed_royalty_pct BETWEEN 0 AND 100),
  token_hash            text        UNIQUE,
  expires_at            timestamptz,
  reminder_sent_at      timestamptz,
  decided_at            timestamptz,
  decided_by            uuid        REFERENCES users(id),
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (stage <> 'author' OR (token_hash IS NOT NULL AND expires_at IS NOT NULL))
);
CREATE INDEX approvals_book_idx ON approvals (book_id);
CREATE INDEX approvals_pending_idx ON approvals (stage, status) WHERE status = 'pending';

-- =====================================================================
-- 6. ORDERS & PAYMENTS — M-Pesa Daraja STK Push  (§5.5)
--   Daraja callbacks are not signed, so a payment is only accepted after
--   (a) secret callback path, (b) idempotency on CheckoutRequestID, and
--   (c) a server-side STK Push Query confirming ResultCode 0.
-- =====================================================================
CREATE TABLE orders (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id                    uuid         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  book_id                     uuid         NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
  amount_kes                  numeric(12,2) NOT NULL CHECK (amount_kes >= 0),
  status                      order_status NOT NULL DEFAULT 'pending',
  idempotency_key             text         NOT NULL UNIQUE,
  mpesa_phone_last4           text,
  mpesa_merchant_request_id   text,
  mpesa_checkout_request_id   text UNIQUE,
  mpesa_receipt               text UNIQUE,
  failure_reason              text,
  created_at                  timestamptz  NOT NULL DEFAULT now(),
  paid_at                     timestamptz,
  updated_at                  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX orders_buyer_idx ON orders (buyer_id);
-- a buyer can only have one paid order per book
CREATE UNIQUE INDEX orders_one_paid_per_book ON orders (buyer_id, book_id) WHERE status = 'paid';
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Raw callback log + idempotency (§10 "idempotency keys").
CREATE TABLE payment_events (
  id            bigserial PRIMARY KEY,
  provider      text        NOT NULL DEFAULT 'mpesa',
  event_key     text        NOT NULL,          -- CheckoutRequestID
  payload       jsonb       NOT NULL,
  source_ip     inet,
  received_at   timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz,
  result        text,
  UNIQUE (provider, event_key)
);

-- =====================================================================
-- 7. SALES LEDGER  (§2.1, §2.2, §7 split engine) — the crown jewels
--   Append-only. Corrections are 'reversal' rows. The only permitted UPDATE
--   is payout allocation/locking (payout_cycle_id, paid_at), once each.
-- =====================================================================
CREATE TABLE sales_ledger (
  id                         bigserial PRIMARY KEY,
  entry_type                 ledger_entry NOT NULL DEFAULT 'sale',
  reverses_id                bigint       REFERENCES sales_ledger(id),
  order_id                   uuid         REFERENCES orders(id),
  book_id                    uuid         NOT NULL REFERENCES books(id),
  buyer_id                   uuid         REFERENCES users(id),
  author_id                  uuid         NOT NULL REFERENCES users(id),
  publisher_id               uuid         REFERENCES users(id),
  owner_id                   uuid         REFERENCES users(id),  -- direct sale: author or superadmin
  is_publisher_sale          boolean      NOT NULL,

  gross                      numeric(12,2) NOT NULL,
  fee_rate                   numeric(5,2)  NOT NULL,              -- frozen at sale (§2.1)
  fee_amount                 numeric(12,2) NOT NULL,
  author_royalty_pct         numeric(5,2),                         -- frozen copy
  author_royalty_amount      numeric(12,2) NOT NULL DEFAULT 0,
  publisher_margin           numeric(12,2) NOT NULL DEFAULT 0,
  owner_amount               numeric(12,2) NOT NULL DEFAULT 0,
  publisher_sold_titles      integer,                              -- tier input, frozen

  payout_cycle_id            uuid,                                 -- FK added below
  paid_at                    timestamptz,
  created_at                 timestamptz  NOT NULL DEFAULT now(),

  CHECK (entry_type = 'sale' OR reverses_id IS NOT NULL),
  CHECK (fee_amount + author_royalty_amount + publisher_margin + owner_amount = gross),
  CHECK ((is_publisher_sale AND publisher_id IS NOT NULL AND owner_amount = 0)
      OR (NOT is_publisher_sale AND owner_id IS NOT NULL
          AND author_royalty_amount = 0 AND publisher_margin = 0))
);
CREATE UNIQUE INDEX sales_ledger_one_sale_per_order ON sales_ledger (order_id) WHERE entry_type = 'sale';
CREATE INDEX sales_ledger_book_idx      ON sales_ledger (book_id);
CREATE INDEX sales_ledger_publisher_idx ON sales_ledger (publisher_id, book_id);
CREATE INDEX sales_ledger_unallocated   ON sales_ledger (created_at) WHERE payout_cycle_id IS NULL;

CREATE OR REPLACE FUNCTION ledger_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'sales_ledger is append-only; post a reversal instead'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- UPDATE: only allocation + locking, each set once, nothing else.
  IF (to_jsonb(NEW) - 'payout_cycle_id' - 'paid_at') <> (to_jsonb(OLD) - 'payout_cycle_id' - 'paid_at') THEN
    RAISE EXCEPTION 'sales_ledger financial fields are immutable' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.paid_at IS NOT NULL THEN
    RAISE EXCEPTION 'sales_ledger line % is locked (paid)', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.payout_cycle_id IS NOT NULL AND NEW.payout_cycle_id IS DISTINCT FROM OLD.payout_cycle_id THEN
    RAISE EXCEPTION 'sales_ledger line % already allocated to a cycle', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER sales_ledger_guard BEFORE UPDATE OR DELETE ON sales_ledger
  FOR EACH ROW EXECUTE FUNCTION ledger_guard();

-- =====================================================================
-- 8. DRM LICENCES & DEVICES  (§6)
-- =====================================================================
CREATE TABLE devices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint_hash text        NOT NULL,          -- sha256 of client device id
  label            text        NOT NULL,          -- e.g. "Chrome on Windows 11"
  platform         text,
  model            text,                          -- from UA client hints where available
  last_ip          inet,
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  revoked_at       timestamptz,
  UNIQUE (user_id, fingerprint_hash)
);

CREATE TABLE licences (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  book_id      uuid        NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
  order_id     uuid        REFERENCES orders(id),
  max_devices  integer     NOT NULL DEFAULT 3 CHECK (max_devices BETWEEN 1 AND 10),
  issued_at    timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz,
  revoked_at   timestamptz,
  UNIQUE (user_id, book_id)
);

CREATE TABLE licence_devices (
  licence_id  uuid NOT NULL REFERENCES licences(id) ON DELETE CASCADE,
  device_id   uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  added_at    timestamptz NOT NULL DEFAULT now(),
  removed_at  timestamptz,
  PRIMARY KEY (licence_id, device_id)
);

CREATE OR REPLACE FUNCTION licence_device_limit() RETURNS trigger AS $$
DECLARE lim integer; active integer;
BEGIN
  SELECT max_devices INTO lim FROM licences WHERE id = NEW.licence_id;
  SELECT count(*) INTO active FROM licence_devices
   WHERE licence_id = NEW.licence_id AND removed_at IS NULL AND device_id <> NEW.device_id;
  IF NEW.removed_at IS NULL AND active >= lim THEN
    RAISE EXCEPTION 'device limit (%) reached for this licence', lim USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER licence_devices_limit BEFORE INSERT OR UPDATE ON licence_devices
  FOR EACH ROW EXECUTE FUNCTION licence_device_limit();

-- Screenshot / capture attempts on protected views (client requirement).
CREATE TABLE security_events (
  id           bigserial PRIMARY KEY,
  user_id      uuid        REFERENCES users(id) ON DELETE SET NULL,
  device_id    uuid        REFERENCES devices(id) ON DELETE SET NULL,
  book_id      uuid        REFERENCES books(id) ON DELETE SET NULL,
  event_type   security_event_type NOT NULL,
  page         text,
  device_label text,
  ip           inet,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX security_events_user_idx ON security_events (user_id, created_at DESC);
CREATE INDEX security_events_time_idx ON security_events (created_at DESC);

-- =====================================================================
-- 9. PAYOUTS  (§2.5, §5.6, §7)
-- =====================================================================
CREATE TABLE payout_cycles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payday        date        NOT NULL UNIQUE,     -- 2nd / 4th Thursday
  window_start  timestamptz NOT NULL,
  window_end    timestamptz NOT NULL,            -- exclusive: Thursday 00:00 EAT (sales through Wed 23:59:59)
  status        payout_cycle_status NOT NULL DEFAULT 'upcoming',
  generated_at  timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (window_end > window_start),
  CHECK (extract(isodow FROM payday) = 4)
);
ALTER TABLE sales_ledger
  ADD CONSTRAINT sales_ledger_cycle_fk FOREIGN KEY (payout_cycle_id) REFERENCES payout_cycles(id);

CREATE TABLE payout_report_lines (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id           uuid        NOT NULL REFERENCES payout_cycles(id) ON DELETE RESTRICT,
  payee_id           uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  net_amount         numeric(12,2) NOT NULL CHECK (net_amount >= 0),
  method_snapshot    jsonb,                      -- encrypted values + last4, never plaintext
  name_match         boolean     NOT NULL,       -- re-verified at report time (§2.6)
  status             payout_line_status NOT NULL DEFAULT 'pending',
  hold_reason        text,
  payment_reference  text,                       -- M-Pesa / bank ref entered by superadmin
  paid_at            timestamptz,
  paid_by            uuid        REFERENCES users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, payee_id),                   -- idempotent generation (§11)
  CHECK (status <> 'held' OR hold_reason IS NOT NULL),
  CHECK (status <> 'paid' OR (paid_at IS NOT NULL AND paid_by IS NOT NULL))
);

-- Which ledger amounts make up each report line (one ledger row can pay
-- an author AND a publisher).
CREATE TABLE payout_line_items (
  payout_line_id  uuid        NOT NULL REFERENCES payout_report_lines(id) ON DELETE RESTRICT,
  ledger_id       bigint      NOT NULL REFERENCES sales_ledger(id) ON DELETE RESTRICT,
  payee_role      payee_role  NOT NULL,
  amount          numeric(12,2) NOT NULL,
  PRIMARY KEY (payout_line_id, ledger_id, payee_role),
  UNIQUE (ledger_id, payee_role)
);

-- =====================================================================
-- 10. AUDIT LOG  (§10 — every superadmin action)
-- =====================================================================
CREATE TABLE audit_log (
  id           bigserial PRIMARY KEY,
  actor_id     uuid        REFERENCES users(id) ON DELETE SET NULL,
  actor_role   user_role,
  action       text        NOT NULL,             -- e.g. book.approve, payout.mark_paid
  entity_type  text,
  entity_id    text,
  metadata     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ip           inet,
  user_agent   text,
  request_id   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_actor_idx  ON audit_log (actor_id, created_at DESC);
CREATE INDEX audit_log_entity_idx ON audit_log (entity_type, entity_id);
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION forbid_change();

-- =====================================================================
-- 11. EMAIL LOG  (§8 — queue lives in Redis; this is the durable record)
-- =====================================================================
CREATE TABLE email_log (
  id            bigserial PRIMARY KEY,
  template      text        NOT NULL,            -- author_approval_request, payout_paid, ...
  to_user_id    uuid        REFERENCES users(id) ON DELETE SET NULL,
  to_email      text        NOT NULL,
  subject       text        NOT NULL,
  status        text        NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  provider_id   text,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz
);
