# Netskope policy: browser traffic to idea-impact.com

Internal dashboard (`web-dashboard`) is served at **https://idea-impact.com** behind Traefik on the VPS. Corporate Netskope clients may block or silently drop browser traffic when DLP/heuristic inspection flags minified JavaScript, large static assets, or high-entropy JSON API responses.

**Symptoms (browser path):** `/_next/static` chunk loads hang or fail without clear HTTP errors; login or tool pages stall; Web Capture crawl responses never complete in the UI.

**Out of scope for this document:** SSH deploy to `srv1139701.hstgr.cloud`, `ghcr.io` image pulls, and GitHub Actions runners. Those use different hostnames; see [ci-cd.md](ci-cd.md) if those paths need separate policies.

Application mitigations in-repo: isolated `/login` layout (no dashboard fonts/providers), client-fetched home data (no large RSC JSON in `/` HTML), per-tool lazy chunks, Web Capture full-text and PDFs off by default with base64 stripped from React state, hero WebP under `public/brand/`. NetOps may still apply tenant policies below for edge cases.

---

## Required Netskope Tenant Manager configuration

Submit to NetOps / security engineering. Wording matches the infrastructure request for internal tool deployments.

### 1. Custom URL list

| Entry | Value |
|-------|--------|
| Target domain | `idea-impact.com` |
| Wildcard domain | `*.idea-impact.com` |

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
| Destination | `*.idea-impact.com` |
| Reason | Clients and scripts must not see Netskope MITM certificates on production TLS |

### 4. DLP / real-time protection content waiver

If full steering bypass is not approved, apply to the same URL list:

- **Allow high-entropy strings** — compiled UI assets (Base64 in API JSON, minified JS) must not be blocked as obfuscated exfiltration.
- **Raise file scan thresholds** — outbound/inbound `.js`, `.map`, `.json` multipart and chunked transfers should not hit byte-size or rate caps used for generic DLP.

Optional: **Skope IT → URL Lookup** for `idea-impact.com` — recategorize if stuck as Uncategorized / Newly Observed Domain despite production use.

---

## Verification checklist (after policy + deploy)

Run from any host with HTTPS access to production. Detailed header expectations: [auth-keycloak.md](auth-keycloak.md#production-security-headers-netskope--swg).

```bash
# Health
curl -fsS https://idea-impact.com/health

# Unauthenticated root → login redirect
curl -sSI https://idea-impact.com/ | grep -iE '^HTTP/|^location:|^content-type:'

# Security headers on login
curl -sSI https://idea-impact.com/login | grep -iE 'strict-transport|x-frame|x-content-type|referrer-policy|x-xss'

# Static JS/CSS reachable (replace CSS path from /login HTML if needed)
CSS=$(curl -sS https://idea-impact.com/login | grep -oE '/_next/static/css/[^"'\'' ]+\.css' | head -1)
curl -sSI "https://idea-impact.com${CSS}" | grep -iE '^HTTP/|^content-type:'

# Brand hero (WebP after mitigations)
curl -sSI https://idea-impact.com/brand/ragtag-stack.webp | grep -iE '^HTTP/|^content-type:'

# Icons
curl -sSI https://idea-impact.com/favicon.ico | grep -iE '^HTTP/|^content-type:'
curl -sSI https://idea-impact.com/icon.svg | grep -iE '^HTTP/|^content-type:'
```

**Corp browser (manual):**

1. Load `/login` — Network tab should show only framework + login page chunks (no dashboard shell `7614` / hero `8893` chunks, no `@fontsource` woff2 storm).
2. Sign in — redirects stay on `idea-impact.com` (never `http://localhost:3000`).
3. On `/` — initial HTML is small (skeleton); six `/api/...` calls load after paint; shell/hero/hub chunks load on demand.
4. Open `/tools/web-capture` — only the web-capture panel chunk + hub shell; not every tool panel.
5. Crawl with default settings (full article text off, PDFs off) — response renders without silent drop.
6. Enable full text or PDFs only when needed — larger JSON; may still need DLP waiver.

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
