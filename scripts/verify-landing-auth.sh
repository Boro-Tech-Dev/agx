#!/usr/bin/env bash
# Smoke-test OIDC entry points (post-deploy). No login landing page — / redirects to OIDC.
# Usage: ./scripts/verify-landing-auth.sh [base-url]
set -euo pipefail

BASE="${1:-https://idea-impact.com}"
BASE="${BASE%/}"
AUTH_HOST="${KEYCLOAK_PUBLIC_HOST:-auth.idea-impact.com}"
AUTH_BASE="https://${AUTH_HOST}"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

warn() {
  echo "WARN: $*" >&2
}

echo "Verifying auth at ${BASE} ..."

if ! getent hosts "$AUTH_HOST" >/dev/null 2>&1 && ! host "$AUTH_HOST" >/dev/null 2>&1; then
  warn "${AUTH_HOST} has no DNS — add an A record to the VPS IP before deploy (Netskope RBI requires IdP on auth subdomain)"
fi

ROOT_LOC="$(curl -sSI "${BASE}/" | tr -d '\r' | awk -F': ' 'tolower($1)=="location"{print $2; exit}')"
[[ -n "$ROOT_LOC" ]] || fail 'GET / must redirect unauthenticated users'
echo "$ROOT_LOC" | grep -q '/api/auth/login' || fail "GET / must redirect to /api/auth/login (got: ${ROOT_LOC})"
echo "  OK: GET / → /api/auth/login"

LOGIN_LOC="$(curl -sSI "${BASE}/login" | tr -d '\r' | awk -F': ' 'tolower($1)=="location"{print $2; exit}')"
[[ -n "$LOGIN_LOC" ]] || fail 'GET /login must redirect'
echo "$LOGIN_LOC" | grep -q '/api/auth/login' || fail "GET /login must redirect to /api/auth/login (got: ${LOGIN_LOC})"
echo "  OK: GET /login → /api/auth/login"

AUTH_LOC="$(curl -sSI "${BASE}/api/auth/login" | tr -d '\r' | awk -F': ' 'tolower($1)=="location"{print $2; exit}')"
[[ -n "$AUTH_LOC" ]] || fail 'GET /api/auth/login must redirect'
echo "$AUTH_LOC" | grep -q '/realms/' || fail "OIDC authorize must target Keycloak /realms/ (got: ${AUTH_LOC})"
echo "$AUTH_LOC" | grep -q 'signin=failed' && fail 'OIDC must not redirect to signin=failed'
echo "$AUTH_LOC" | grep -qi "https://${AUTH_HOST}/" || fail "OIDC authorize must use https://${AUTH_HOST} (got: ${AUTH_LOC})"
echo "  OK: GET /api/auth/login → Keycloak authorize on ${AUTH_HOST}"

CB_LOC="$(curl -sSI "${BASE}/api/auth/callback?error=access_denied" | tr -d '\r' | awk -F': ' 'tolower($1)=="location"{print $2; exit}')"
[[ -n "$CB_LOC" ]] || fail 'GET /api/auth/callback?error= must redirect'
echo "$CB_LOC" | grep -q '/api/auth/login' || fail "callback OAuth error must retry /api/auth/login (got: ${CB_LOC})"
echo "  OK: GET /api/auth/callback?error= → /api/auth/login"

DISCOVERY=""
for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
  DISCOVERY="$(curl -fsS "${AUTH_BASE}/realms/platform/.well-known/openid-configuration" 2>/dev/null || true)"
  if echo "$DISCOVERY" | grep -q '"issuer"[[:space:]]*:[[:space:]]*"https://'; then
    break
  fi
  if [[ "$attempt" -lt 12 ]]; then
    echo "  waiting for Keycloak https issuer (attempt ${attempt}/12)..."
    sleep 10
  fi
done
[[ -n "$DISCOVERY" ]] || fail "OIDC discovery must be reachable at ${AUTH_BASE}/realms/platform"
echo "$DISCOVERY" | grep -q '"issuer"[[:space:]]*:[[:space:]]*"https://' || fail "Keycloak issuer must be https (got non-https issuer)"
echo "$DISCOVERY" | grep -q "\"issuer\".*${AUTH_HOST}" || fail "Keycloak issuer must use ${AUTH_HOST}"
echo "  OK: Keycloak issuer is https on ${AUTH_HOST}"

LOGIN_HTML="$(curl -fsS "${AUTH_LOC}")"
echo "$LOGIN_HTML" | grep -q 'action="http://' && fail 'Keycloak login form must not POST to http:// (Netskope RBI / downgrade signal)'
echo "$LOGIN_HTML" | grep -q 'type="password"' && echo "$LOGIN_HTML" | grep -q "${AUTH_HOST}" || fail 'Password form must be served from auth subdomain'
echo "  OK: Keycloak login form uses https on ${AUTH_HOST}"

echo "All auth checks passed."
