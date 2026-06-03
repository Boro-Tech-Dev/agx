#!/usr/bin/env bash
# Smoke-test OIDC entry points (post-deploy). No login landing page — / redirects to OIDC.
# Usage: ./scripts/verify-landing-auth.sh [base-url]
set -euo pipefail

BASE="${1:-https://idea-impact.com}"
BASE="${BASE%/}"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

echo "Verifying auth at ${BASE} ..."

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
echo "  OK: GET /api/auth/login → Keycloak authorize"

CB_LOC="$(curl -sSI "${BASE}/api/auth/callback?error=access_denied" | tr -d '\r' | awk -F': ' 'tolower($1)=="location"{print $2; exit}')"
[[ -n "$CB_LOC" ]] || fail 'GET /api/auth/callback?error= must redirect'
echo "$CB_LOC" | grep -q '/api/auth/login' || fail "callback OAuth error must retry /api/auth/login (got: ${CB_LOC})"
echo "  OK: GET /api/auth/callback?error= → /api/auth/login"

echo "All auth checks passed."
