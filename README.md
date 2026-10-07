# Laibu

A DRM-protected ebook marketplace for Kenya. The spec is `DEVELOPER_DOCUMENTATION.pdf` (v1.0, Oct 2026).

| Folder | What |
|---|---|
| `api/` | NestJS API: `/api/*`, PostgreSQL, deny-by-default role guard |
| `web/` | Next.js 16 site: public storefront, dashboard, and the admin panel on its own host |
| `database/` | `DATABASE_SCHEMA.sql` (source of truth), migrations, seeds |
| `docs/` | Approval email template; Terms/Privacy placeholders (awaiting the client's legal text) |

## Run locally (Windows)

Needs Node 24 and PostgreSQL 18. Redis isn't needed until Sprint 2 (use Memurai on Windows).

```bash
# 1. database
createdb -U postgres laibu

# 2. API
cd api
npm install
cp .env.example .env          # set the DATABASE_URL password
npm run keys:generate -- --with-data-key   # paste the 3 printed lines into .env
npm run db:migrate -- --seed
# create the superadmin (the only way to get one; run in PowerShell):
#   $env:SUPERADMIN_EMAIL="you@example.com"; $env:SUPERADMIN_NAME="Your Name"; $env:SUPERADMIN_PASSWORD="<14+ chars>"; npm run admin:create
npm run start:dev             # http://localhost:4000/api/health
# Windows: run the API from PowerShell, not Git Bash (Git Bash rewrites TZ and the API refuses to start)

# 3. web (second terminal)
cd web
npm install
npm run dev                   # http://localhost:3000
```

| URL | What |
|---|---|
| http://localhost:3000 | Public storefront (preloader on first load) |
| http://localhost:3000/styleguide | Design system and every component (dev only, 404 in production) |
| http://localhost:3000/signup · /login | Create an account (reader, author, publisher) and sign in |
| http://localhost:3000/dashboard | Signed-in area: setup checklist, settings, payout method |
| http://admin.localhost:3000 | Admin panel (superadmin sign-in at `/login`). **Only** on this host; `/admin` on the public site is a 404 |

In production, set `ADMIN_HOST=admin.laibu.co.ke` for the web app.

## Security baseline

- **Browser**
  - Per-request nonce CSP, so only our own scripts run. HSTS, `X-Frame-Options: DENY`, a strict Permissions-Policy.
  - The browser only talks to its own origin (`/api` is proxied), so cookies stay first-party.
- **API**
  - Every route needs sign-in unless it's marked `@Public()`. `@Roles()` narrows access further; the superadmin passes every role check.
  - Unknown fields are rejected, bodies are capped at 100 kB, and requests are rate-limited.
  - Error responses never include stack traces or SQL; every response carries a request id.
- **Database**
  - The ledger, audit log and terms acceptances are append-only, enforced by triggers.
  - Ledger lines lock once paid. Payout rules (bank-only for publishers, name match) are enforced in the database as well as the API.
  - The 3-device licence limit is enforced in the database.
- **Data:** bank and M-Pesa numbers are encrypted with AES-256-GCM, bound to the owning user.
- **Protected views:** `<SecureView>` blacks out the reader and payout details on capture attempts and watermarks content with the buyer's identity.

## Accounts & sessions (Sprint 1)

- **Passwords**
  - Hashed with argon2id.
  - At least 10 characters. Common passwords and ones containing the user's name or email are refused.
  - Unknown emails take as long to reject as wrong passwords, so timing reveals nothing.
- **Lockout:** 5 failed sign-ins lock the account for 15 minutes. Sign-in, signup and payout changes have their own rate limits.
- **Sessions**
  - A 15-minute RS256 JWT plus a 30-day refresh token. The refresh token is single-use and rotated each time.
  - Reusing an old refresh token is treated as theft and ends the whole session.
  - The browser holds both in HttpOnly, SameSite=Strict cookies. API clients get the JWT as a Bearer token (§5).
- **CSRF:** any cookie-authenticated request that changes data must come from our own origin.
- **Admin**
  - The superadmin can only be created by script and can only sign in on the admin host. The API checks the Origin, so admin cookies never land on the public site.
  - Admin sessions are shorter: 10 minutes for the JWT and 12 hours for the refresh token.
  - Every admin sign-in, failed sign-in and terms publication is audited.
- **Terms gate (§9):** signup records acceptance with IP and browser. When the admin publishes a new version, every request returns 428 until the user accepts it in the popup.
- **Payout method (§2.6)**
  - Authors can use M-Pesa or bank; publishers can only use bank.
  - The account name must match the profile name. This is enforced in the UI, the API and a database trigger.
  - Changing the payout method needs the password again. Numbers are encrypted, and only the last 4 digits are ever returned.

Tests: `npm test` in `api/` runs 17 unit tests. `api/test/security-e2e.sh` runs 47 end-to-end security checks against a disposable database.

## Deviations from the spec (agreed or required)

- **§7 `isPayday()`:** the sample code never fired on the 4th Thursday and read the date in UTC. It is fixed and tested in `api/src/payouts/payday.ts`.
- **Earning windows** are half-open, ending at Thursday 00:00 EAT. This is the same boundary as the doc's "Wednesday 23:59:59", without the one-second gap.
- **Next.js `cacheComponents`** is off. Its pre-rendered pages can't carry a CSP nonce.
