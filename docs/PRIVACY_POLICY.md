# Privacy Policy: PLACEHOLDER

> **Status: awaiting the client's legal text.** This is not a legal document.
> It must comply with Kenya's **Data Protection Act, 2019**. The client should
> also check whether they must register with the **ODPC** (Office of the Data
> Protection Commissioner).

Version: `0.0-placeholder`

What the system actually collects (for the lawyer drafting the real policy):

| Data | Why | Where it's stored | Protection |
|---|---|---|---|
| Name, email, phone, role | Account, receipts, approvals | `users` | Access limited by role |
| Password | Login | `users.password_hash` | argon2id hash only, never stored in plain text |
| Terms acceptance (version, time, IP, browser) | Contract evidence | `user_terms_acceptances` | Append-only, kept 7 years |
| M-Pesa number / bank account | Paying authors & publishers | `payout_methods` | AES-256-GCM encrypted, only last 4 digits visible |
| Purchases, M-Pesa receipt | Licences, accounting | `orders`, `sales_ledger` | Ledger is append-only |
| Devices (browser/OS label, model, hashed device ID, IP) | DRM device limit (3) | `devices` | Device ID stored as a hash |
| Capture attempts on protected pages | Anti-piracy | `security_events` | Superadmin only |
| Admin actions | Accountability | `audit_log` | Append-only |

The real policy also needs: lawful basis, retention periods, data-subject rights
(access, correction, deletion where the law allows), processors (M-Pesa/Safaricom,
the email provider, hosting/storage), cross-border transfers, cookies, and a contact
for privacy requests.
