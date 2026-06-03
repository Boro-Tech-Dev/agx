# Netskope policy: browser traffic to idea-impact.com

Internal dashboard (`web-dashboard`) is served at **https://idea-impact.com** behind Traefik on the VPS. Corporate Netskope clients may block or silently drop browser traffic when DLP/heuristic inspection flags minified JavaScript, large static assets, or high-entropy JSON API responses.

**Symptoms (browser path):** `/_next/static` chunk loads hang or fail without clear HTTP errors; login or tool pages stall; Web Capture crawl responses never complete in the UI.

**Out of scope for this document:** SSH deploy to `srv1139701.hstgr.cloud`, `ghcr.io` image pulls, and GitHub Actions runners. Those use different hostnames; see [ci-cd.md](ci-cd.md) if those paths need separate policies.

Application mitigations in-repo: public landing at `/` (no password fields), OIDC login on **auth.idea-impact.com** (no credential form on idea-impact.com), client-fetched home data at `/home`, per-tool lazy chunks, Web Capture staging credentials via uploaded project profiles (no password inputs in browser), hero WebP under `public/brand/`. NetOps ticket template: [netskope-netops-ticket.md](netskope-netops-ticket.md).

---

## Required Netskope Tenant Manager configuration

Submit to NetOps / security engineering. Wording matches the infrastructure request for internal tool deployments.

### 1. Custom URL list

| Entry | Value |
|-------|--------|
| Target domain | `idea-impact.com` |
| Wildcard domain | `*.idea-impact.com` |
| IdP (Keycloak OIDC) | `auth.idea-impact.com` |

### 2. Traffic steering exception

| Field | Value |
|-------|--------|
| Exception type | Real-Time Protection / Steering Exception |
| Action | Bypass / Direct Routing |
| Destinations | Custom URL list above |
| Reason | Engineering dashboard; prevents silent drops on large `/_next/static` transfers and API payloads |

### 3. SSL decryption exception

| Field | Value |
|-------|--------|
| Rule policy | Do Not Decrypt (DND) |
| Destination | `idea-impact.com`, `*.idea-impact.com`, `auth.idea-impact.com` |
| Reason | Clients and scripts must not see Netskope MITM certificates on production TLS |

### 4. Real-time protection — Allow (not Isolate)

| Field | Value |
|-------|--------|
| Action | **Allow** — do not apply Remote Browser Isolation |
| Destinations | Same URL list |
| Reason | Approved internal dashboard; credentials entered on `auth.idea-impact.com` only |

### 5. DLP / real-time protection content waiver

If full steering bypass is not approved, apply to the same URL list:

- **Allow high-entropy strings** — compiled UI assets (Base64 in API JSON, minified JS) must not be blocked as obfuscated exfiltration.
- **Raise file scan thresholds** — outbound/inbound `.js`, `.map`, `.json` multipart and chunked transfers should not hit byte-size or rate caps used for generic DLP.

Optional: **Skope IT → URL Lookup** for `idea-impact.com` and `auth.idea-impact.com` — recategorize if stuck as Uncategorized / Newly Observed Domain despite production use.

---

## Verification checklist (after policy + deploy)

Run from any host with HTTPS access to production. Detailed header expectations: [auth-keycloak.md](auth-keycloak.md#production-security-headers-netskope--swg).

```bash
# Health
curl -fsS https://idea-impact.com/health

# Unauthenticated root → public landing (no redirect to login)
curl -sSI https://idea-impact.com/ | grep -iE '^HTTP/|^location:|^content-type:'
curl -sS https://idea-impact.com/ | grep -ci 'type="password"' || true
# Expect: HTTP 200, 0 password fields

# Login starts OIDC on auth subdomain
curl -sSI 'https://idea-impact.com/login' | grep -i location
# Expect: Location contains auth.idea-impact.com

# Keycloak OIDC discovery
curl -fsS 'https://auth.idea-impact.com/realms/platform/.well-known/openid-configuration' | head -c 200

# Security headers on landing
curl -sSI https://idea-impact.com/ | grep -iE 'strict-transport|x-frame|x-content-type|referrer-policy|x-xss'

# Brand hero (WebP after mitigations)
curl -sSI https://idea-impact.com/brand/ragtag-stack.webp | grep -iE '^HTTP/|^content-type:'

# Icons
curl -sSI https://idea-impact.com/favicon.ico | grep -iE '^HTTP/|^content-type:'
curl -sSI https://idea-impact.com/icon.svg | grep -iE '^HTTP/|^content-type:'
```

**Corp browser (manual):**

1. Load `/` — public landing with `idea-impact.com` visible text; no password fields; click **Sign in**.
2. Sign in — browser redirects to **auth.idea-impact.com** for credentials (not RBI read-only on idea-impact.com).
3. After auth — `/home` loads; no password POST to idea-impact.com in Network tab.
4. On `/home` — initial HTML is small (skeleton); `/api/...` calls load after paint; shell/hero/hub chunks load on demand.
5. Open `/tools/web-capture` — no password input fields; staging via uploaded profile JSON only.
6. Crawl with default settings (full article text off, PDFs off) — response renders without silent drop.

---

## Developer isolation (diagnostic only)

### Protocol A — inline Base64 / large SVGs in source

**Status in repo:** Satisfied. Brand images live under `apps/web-dashboard/public/brand/` (WebP hero). No `data:image` in TS/TSX/CSS. Small inline SVGs only in decorative components.

### Protocol B — disable minification (local test)

One-off branch only — **not for production**:

```js
// next.config.js (temporary diagnostic)
module.exports = {
  // ...
  swcMinify: false,
};
```

If an unminified local `npm run build` + browser load succeeds where production fails, entropy/compression inspection is confirmed. Revert before merge.

---

## Related

- [auth-keycloak.md](auth-keycloak.md) — Keycloak, headers, full curl suite
- [ci-cd.md](ci-cd.md) — GHCR + SSH deploy (non-browser)
- [docker-compose.traefik.yml](../docker-compose.traefik.yml) — `idea-impact.com` routing
