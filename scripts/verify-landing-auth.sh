#!/usr/bin/env bash
# Smoke-test public landing and OIDC entry points (post-deploy).
# Usage: ./scripts/verify-landing-auth.sh [base-url]
# Example: ./scripts/verify-landing-auth.sh https://idea-impact.com
set -euo pipefail

BASE="${1:-https://idea-impact.com}"
BASE="${BASE%/}"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

echo "Verifying landing + auth at ${BASE} ..."

LANDING="$(curl -fsS "${BASE}/")"
echo "$LANDING" | grep -q '_next/static' && fail 'landing HTML must not reference _next/static'
echo "$LANDING" | grep -ci 'type="password"' | grep -q '^0$' || fail 'landing must have zero password fields'
BODY_BYTES="$(printf '%s' "$LANDING" | wc -c | tr -d ' ')"
if [[ "$BODY_BYTES" -ge 8192 ]]; then
  fail "landing HTML too large (${BODY_BYTES} bytes; expect < 8 KB)"
fi
echo "$LANDING" | grep -q 'href="/api/auth/login"' || fail 'landing CTA must point to /api/auth/login'
echo "  OK: GET / — plain HTML, no _next/static, ${BODY_BYTES} bytes"

LOGIN_LOC="$(curl -sSI "${BASE}/login" | tr -d '\r' | awk -F': ' 'tolower($1)=="location"{print $2; exit}')"
[[ -n "$LOGIN_LOC" ]] || fail 'GET /login must redirect'
echo "$LOGIN_LOC" | grep -q '/api/auth/login' || fail "GET /login must redirect to /api/auth/login (got: ${LOGIN_LOC})"
echo "  OK: GET /login → /api/auth/login"

AUTH_LOC="$(curl -sSI "${BASE}/api/auth/login" | tr -d '\r' | awk -F': ' 'tolower($1)=="location"{print $2; exit}')"
[[ -n "$AUTH_LOC" ]] || fail 'GET /api/auth/login must redirect'
echo "$AUTH_LOC" | grep -qi 'auth\.idea-impact\.com' || fail "OIDC authorize must target auth.idea-impact.com (got: ${AUTH_LOC})"
echo "  OK: GET /api/auth/login → auth.idea-impact.com"

CB_LOC="$(curl -sSI "${BASE}/api/auth/callback?error=access_denied" | tr -d '\r' | awk -F': ' 'tolower($1)=="location"{print $2; exit}')"
[[ -n "$CB_LOC" ]] || fail 'GET /api/auth/callback?error= must redirect'
echo "$CB_LOC" | grep -q 'signin=failed' || fail "callback OAuth error must redirect to ?signin=failed (got: ${CB_LOC})"
echo "$CB_LOC" | grep -q 'error=' && fail 'callback must not put error= in landing redirect'
echo "  OK: GET /api/auth/callback?error= → /?signin=failed"

echo "All landing + auth checks passed."
