# AUTHOR_APPROVAL_EMAIL — template `author_approval_request`

Sent when a publisher sets up a book with an author's email (§2.3 step 2), or
asks to sell an author's existing live book (`/api/publisher/books/:id/request`).

Rules (DEVELOPER_DOCUMENTATION §8):

- Tokenised **Approve** / **Decline** links. Token = HMAC-SHA256(book_id + author_id + nonce).
  Only the hash is stored (`approvals.token_hash`).
- Single-use and idempotent. A second click shows the settled result, not an error.
- Expires after **14 days**. A reminder goes out on **day 7** if the author hasn't acted.
- Shows the royalty % **and a worked example** computed with the real split engine
  (fee tier at the publisher's current tier, rounded to 2 dp).
- Links open a page (`/approve/:token`). They never act on a bare GET, so email
  scanners and link previewers can't approve by accident. The page asks the author
  to confirm, then POSTs.
- No passwords, account numbers or full buyer data in the email.

---

## Variables

| Variable | Example |
|---|---|
| `{{brand_name}}` | Laibu |
| `{{author_first_name}}` | Wanjiru |
| `{{publisher_name}}` | Longhorn Readers Ltd |
| `{{book_title}}` | The River Between Us |
| `{{price_kes}}` | 800.00 |
| `{{author_royalty_pct}}` | 60 |
| `{{fee_rate}}` | 11 |
| `{{ex_fee}}` | 88.00 |
| `{{ex_remainder}}` | 712.00 |
| `{{ex_author}}` | 427.20 |
| `{{ex_publisher}}` | 284.80 |
| `{{review_url}}` | https://laibu.co.ke/approve/`<token>` |
| `{{expires_on}}` | 21 October 2026 |
| `{{support_email}}` | support@laibu.co.ke |

---

## Subject

`{{publisher_name}} wants to publish "{{book_title}}" on {{brand_name}}. Please review`

Reminder (day 7): `Reminder: "{{book_title}}" is waiting for your approval`

## Preheader

`You'll earn {{author_royalty_pct}}% of each sale after the {{brand_name}} fee. Review by {{expires_on}}.`

## Body

> Hi {{author_first_name}},
>
> **{{publisher_name}}** has asked to sell your book **"{{book_title}}"** on {{brand_name}}.
> Nothing goes live until you agree. After that, our team reviews it too.
>
> **What they're proposing**
>
> | | |
> |---|---|
> | Price | KES {{price_kes}} |
> | Your royalty | **{{author_royalty_pct}}%** of each sale, after the {{brand_name}} fee |
>
> **Example: one sale at KES {{price_kes}}**
>
> | | KES |
> |---|---|
> | Sale price | {{price_kes}} |
> | {{brand_name}} fee ({{fee_rate}}%) | −{{ex_fee}} |
> | Remaining | {{ex_remainder}} |
> | **You receive ({{author_royalty_pct}}%)** | **{{ex_author}}** |
> | Publisher receives | {{ex_publisher}} |
>
> The fee depends on how many titles the publisher has sold, so it may go down
> over time. It never goes up.
> We pay on the 2nd and 4th Thursday of every month, to the M-Pesa or bank account
> you add to your profile.
>
> [ **Review and respond** ]({{review_url}})
>
> This link is personal to you and expires on **{{expires_on}}**. Please don't forward it.
>
> If you don't recognise this request, choose **Decline** or ignore this email.
> Nothing will be published.
>
> Questions? Reply to this email or write to {{support_email}}.
>
> The {{brand_name}} team

---

## Related templates (§8)

- `approval_outcome`: to the publisher (approved / declined / rejected, with notes).
- `payout_report_ready`: to the superadmin.
- `payout_paid`: to the payee, with a statement of the lines paid.
