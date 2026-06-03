# Netskope / SWG: browser traffic to idea-impact.com

Internal dashboard (`web-dashboard`) is served at **https://idea-impact.com** behind Traefik on the VPS. Corporate Netskope clients may block or isolate browser traffic when heuristics flag credential-phishing landing patterns, minified JavaScript, or high-entropy payloads.

**Symptoms (browser path):** Remote Browser Isolation (RBI) on `/`; `/_next/static` chunk loads hang on authenticated routes; tool pages stall; Web Capture responses never complete in the UI.

**Out of scope:** SSH deploy to `srv1139701.hstgr.cloud`, `ghcr.io` image pulls, GitHub Actions runners — see [ci-cd.md](ci-cd.md).

---

## Application mitigations (in-repo)

These are the primary fixes — implemented in code, not tenant policy:

| Mitigation | Detail |
|------------|--------|
| **Zero-JS landing** | [`app/route.ts`](../apps/web-dashboard/app/route.ts) returns plain HTML at `/` — no React, no `/_next/static` on first load |
| **No phishing-template copy** | No domain name in body, no login-panel layout, CTA is “Continue to RagTag” → `/api/auth/login` |
| **Sanitized auth errors** | Callback failures redirect to `/?signin=failed` only (never `/?error=Invalid+username+or+password`) |
| **OIDC on IdP host** | Credentials on **auth.idea-impact.com** only; `KEYCLOAK_ISSUER` must use auth subdomain (see [auth-keycloak.md](auth-keycloak.md)) |
| **Issuer guard** | `buildAuthorizeRedirect` rejects same-host issuer (prevents broken `/realms` loop on dashboard domain) |
| **Protected routes** | Client-fetched data at `/home`; per-tool lazy chunks |
| **Web Capture** | Staging credentials via uploaded project profiles — no password inputs in browser |

Verify after deploy:

```bash
./scripts/verify-landing-auth.sh https://idea-impact.com
```

---

## Verification checklist (post-deploy)

Run from any host with HTTPS access. Header expectations: [auth-keycloak.md](auth-keycloak.md#production-security-headers-netskope--swg).

```bash
# Full landing + OIDC smoke suite
./scripts/verify-landing-auth.sh https://idea-impact.com

# Health
curl -fsS https://idea-impact.com/health

# Keycloak OIDC discovery (requires auth.idea-impact.com DNS)
curl -fsS 'https://auth.idea-impact.com/realms/platform/.well-known/openid-configuration' | head -c 200

# Security headers on landing
curl -sSI https://idea-impact.com/ | grep -iE 'strict-transport|x-frame|x-content-type|referrer-policy|x-xss'
```

**Corp browser (manual):**

1. Load `/` — plain HTML, no RBI read-only overlay; no password fields; click **Continue to RagTag**.
2. Browser redirects to **auth.idea-impact.com** for credentials.
3. After auth — `/home` loads; no password POST to idea-impact.com in Network tab.
4. On `/home` — initial HTML is small; `/api/...` calls load after paint.
5. Open `/tools/web-capture` — no password input fields.

---

## Developer diagnostics

### Protocol A — inline Base64 / large SVGs in source

**Status:** Satisfied. No `data:image` in TS/TSX/CSS for brand assets.

### Protocol B — disable minification (local test only)

One-off branch — **not for production**:

```js
// next.config.js (temporary diagnostic)
module.exports = {
  swcMinify: false,
};
```

If unminified local build succeeds where production fails, DLP/entropy inspection on dashboard chunks is confirmed. Revert before merge.

---

## Related

- [auth-keycloak.md](auth-keycloak.md) — Keycloak, OIDC flow, env vars
- [ci-cd.md](ci-cd.md) — GHCR + SSH deploy
- [docker-compose.traefik.yml](../docker-compose.traefik.yml) — routing for `idea-impact.com` and `auth.idea-impact.com`
