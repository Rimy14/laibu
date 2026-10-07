#!/usr/bin/env bash
# Sprint 1 end-to-end security checks (47). Needs the API on :4000 against a
# DISPOSABLE database on :5499 with migrations + seed + a superadmin
# admin@laibu.test / quiet-river-lantern-26 (see README). Never point it at real data.
B=http://localhost:4000/api
W="Origin: http://localhost:3000"
A="Origin: http://admin.localhost:3000"
J="Content-Type: application/json"
PSQL="C:/Program Files/PostgreSQL/18/bin/psql.exe"
D=$(mktemp -d)
pass=0; fail=0
check() { # label expected actual body
  if [ "$2" = "$3" ]; then echo "PASS  $1"; pass=$((pass+1)); else echo "FAIL  $1 (expected $2, got $3) :: $4"; fail=$((fail+1)); fi
}
req() { # method path jar extraHeader data -> sets CODE BODY
  local m=$1 p=$2 jar=$3 h=$4 d=$5
  local args=(-s -o "$D/body" -w "%{http_code}" -X "$m" -H "$J")
  [ -n "$jar" ] && args+=(-b "$D/$jar" -c "$D/$jar")
  [ -n "$h" ] && args+=(-H "$h")
  [ -n "$d" ] && args+=(--data "$d")
  CODE=$(curl "${args[@]}" "$B$p"); BODY=$(cat "$D/body")
}
has() { echo "$BODY" | grep -q "$1" && echo yes || echo no; }
for i in $(seq 1 20); do curl -s -o /dev/null $B/health && break; sleep 1; done

req GET /terms/current "" "" ""; check "terms/current is public" 200 $CODE "$BODY"
TV=$(echo "$BODY" | node -e "let d=JSON.parse(require('fs').readFileSync(0));console.log(d.terms_of_use.version)")
signup() { # role name email password
  echo "{\"role\":\"$1\",\"full_name\":\"$2\",\"email\":\"$3\",\"phone\":\"0712 345 678\",\"password\":\"$4\",\"accept_terms_version\":\"$TV\",\"accept_policy_version\":\"$TV\"}"
}

req POST /auth/signup author "$W" "$(signup author 'Wanjiru  Kamau' Wanjiru@Example.com password123)"; check "weak password rejected" 422 $CODE "$BODY"
req POST /auth/signup author "$W" "$(signup author 'Wanjiru  Kamau' Wanjiru@Example.com 'green mango season')"; check "signup author" 201 $CODE "$BODY"
check "no password hash in response" no "$(has password_hash)"
check "name whitespace cleaned" yes "$(has '"full_name":"Wanjiru Kamau"')" "$BODY"
check "HttpOnly session cookies set" yes "$(grep -q '#HttpOnly_.*laibu_at' "$D/author" && echo yes || echo no)" "$(cat "$D/author")"
req POST /auth/signup x "$W" "$(signup author 'Someone Else' WANJIRU@example.com 'green mango season')"; check "duplicate email (any case) -> 409" 409 $CODE "$BODY"
req POST /auth/signup x "$W" "$(signup superadmin 'Evil Person' evil@x.ke 'green mango season')"; check "cannot sign up as superadmin" 400 $CODE "$BODY"
req POST /auth/signup x "$W" "{\"role\":\"buyer\",\"full_name\":\"J O\",\"email\":\"j@x.ke\",\"password\":\"green mango season\",\"accept_terms_version\":\"$TV\",\"accept_policy_version\":\"$TV\",\"is_admin\":true}"; check "unknown fields rejected" 400 $CODE "$BODY"

req GET /me author "" ""; check "GET /me with session cookie" 200 $CODE "$BODY"
req GET /me "" "" ""; check "GET /me anonymous -> 401" 401 $CODE "$BODY"
req PATCH /me author "" '{"phone":"0722000000"}'; check "CSRF: cookie write without Origin blocked" 403 $CODE "$BODY"
req PATCH /me author "Origin: https://evil.example" '{"phone":"0722000000"}'; check "CSRF: foreign Origin blocked" 403 $CODE "$BODY"
req PATCH /me author "$W" '{"phone":"0722000000"}'; check "PATCH /me from own origin" 200 $CODE "$BODY"

pm() { echo "{\"type\":\"$1\",\"account_name\":\"$2\",\"mpesa_phone\":\"0712345678\",\"current_password\":\"$3\"}"; }
req PUT /me/payout-method author "$W" "$(pm mpesa 'Wanjiru Kamau' 'wrong password!')"; check "payout: wrong password -> 403" 403 $CODE "$BODY"
req PUT /me/payout-method author "$W" "$(pm mpesa 'John Doe' 'green mango season')"; check "payout: name mismatch rejected" 422 $CODE "$BODY"
req PUT /me/payout-method author "$W" "$(pm mpesa 'wanjiru KAMAU' 'green mango season')"; check "payout: M-Pesa saved (match ignores case)" 200 $CODE "$BODY"
check "payout: full number never returned" no "$(has 712345678)" "$BODY"
ENC=$("$PSQL" -h localhost -p 5499 -U postgres -d laibu_test -tAc "select position('712345678' in encode(mpesa_phone_enc,'escape')) = 0 from payout_methods")
check "payout: number encrypted in database" t "$ENC"

echo "  (waiting 61s for the signup rate-limit window)"; sleep 61
req POST /auth/signup pub "$W" "$(signup publisher 'Longhorn Readers' pub@x.ke 'green mango season')"; check "signup publisher" 201 $CODE "$BODY"
req PUT /me/payout-method pub "$W" "$(pm mpesa 'Longhorn Readers' 'green mango season')"; check "publisher cannot use M-Pesa" 422 $CODE "$BODY"
req POST /auth/signup buyer "$W" "$(signup buyer 'Juma Otieno' buyer@x.ke 'green mango season')"; check "signup buyer" 201 $CODE "$BODY"
req GET /me/payout-method buyer "" ""; check "buyer has no payout access -> 403" 403 $CODE "$BODY"
req GET /admin/terms author "" ""; check "author cannot reach admin routes" 403 $CODE "$BODY"

for i in 1 2 3 4; do req POST /auth/login "" "$W" '{"email":"buyer@x.ke","password":"nope nope nope"}'; done
check "wrong password -> generic 401" 401 $CODE "$BODY"
req POST /auth/login "" "$W" '{"email":"buyer@x.ke","password":"nope nope nope"}'; check "5th failure locks the account" 401 $CODE "$BODY"
check "lock message tells user to wait 15 min" yes "$(has '15 minutes')" "$BODY"
req POST /auth/login "" "$W" '{"email":"buyer@x.ke","password":"green mango season"}'; check "locked even with the right password" 429 $CODE "$BODY"
req POST /auth/login "" "$W" '{"email":"nobody@x.ke","password":"green mango season"}'; check "unknown email -> same generic 401" 401 $CODE "$BODY"

req POST /auth/login "" "$W" '{"email":"admin@laibu.test","password":"quiet-river-lantern-26"}'; check "superadmin can't use the public sign-in" 401 $CODE "$BODY"
req POST /admin/auth/login admin "$W" '{"email":"admin@laibu.test","password":"quiet-river-lantern-26"}'; check "admin sign-in from public site blocked" 403 $CODE "$BODY"
req POST /admin/auth/login admin "$A" '{"email":"wanjiru@example.com","password":"green mango season"}'; check "author can't use the admin sign-in" 401 $CODE "$BODY"
req POST /admin/auth/login admin "$A" '{"email":"admin@laibu.test","password":"quiet-river-lantern-26"}'; check "admin sign-in on admin host" 200 $CODE "$BODY"
req GET /admin/terms admin "" ""; check "admin lists terms versions" 200 $CODE "$BODY"

req POST /admin/terms admin "$A" '{"doc":"terms_of_use","version":"1.0","title":"Terms of Use","content_md":"Updated terms text for testing the re-acceptance gate."}'; check "admin publishes new terms" 201 $CODE "$BODY"
req GET /me author "" ""; TC=$(echo "$BODY" | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).terms_current)"); check "user now has terms_current=false" false "$TC" "$BODY"
req PATCH /me author "$W" '{"phone":"0722000001"}'; check "stale terms -> 428" 428 $CODE "$BODY"
check "428 carries requires_acceptance" yes "$(has '"requires_acceptance":true')" "$BODY"
req POST /auth/terms/accept author "$W" "{\"accept_terms_version\":\"0.0-placeholder\",\"accept_policy_version\":\"$TV\"}"; check "accepting an outdated version refused" 400 $CODE "$BODY"
req POST /auth/terms/accept author "$W" "{\"accept_terms_version\":\"1.0\",\"accept_policy_version\":\"$TV\"}"; check "accept new terms" 200 $CODE "$BODY"
req PATCH /me author "$W" '{"phone":"0722000001"}'; check "after acceptance, writes work again" 200 $CODE "$BODY"

cp "$D/author" "$D/stolen"
req POST /auth/refresh author "$W" ""; check "refresh rotates the session" 200 $CODE "$BODY"
req POST /auth/refresh stolen "$W" ""; check "reused (stolen) refresh token rejected" 401 $CODE "$BODY"
req POST /auth/refresh author "$W" ""; check "theft detection ended the whole session" 401 $CODE "$BODY"

req POST /auth/login pub2 "$W" '{"email":"pub@x.ke","password":"green mango season"}'; check "publisher sign-in" 200 $CODE "$BODY"
req POST /auth/logout pub2 "$W" ""; check "logout" 204 $CODE "$BODY"
req POST /auth/refresh pub2 "$W" ""; check "refresh after logout fails" 401 $CODE "$BODY"

AUD=$("$PSQL" -h localhost -p 5499 -U postgres -d laibu_test -tAc "select string_agg(action, ', ' order by id) from audit_log")
echo "audit trail: $AUD"
echo "== $pass passed, $fail failed"
rm -rf "$D"
