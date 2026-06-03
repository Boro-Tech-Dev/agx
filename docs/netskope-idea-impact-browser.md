# Netskope / SWG: browser traffic to idea-impact.com

Internal dashboard (`web-dashboard`) is served at **https://idea-impact.com** behind Traefik on the VPS.

**Symptoms (browser path):** Remote Browser Isolation (RBI) on a custom login landing; `/_next/static` chunk loads hang on authenticated routes; tool pages stall.

**Out of scope:** SSH deploy, `ghcr.io` image pulls, GitHub Actions runners — see [ci-cd.md](ci-cd.md).

---

## Application mitigations (in-repo)

| Mitigation | Detail |
|------------|--------|
| **No login landing page** | Unauthenticated `GET /` → 302 `/api/auth/login` — no HTML login page on idea-impact.com |
| **Keycloak on `auth.idea-impact.com`** | Traefik routes IdP host to Keycloak; dashboard domain has no password form |
| **OIDC code + PKCE** | No password form or password grant on the dashboard app |
| **Protected routes** | Client-fetched data at `/home`; per-tool lazy chunks |
| **Web Capture** | Staging credentials via uploaded project profiles — no password inputs in browser |

Verify after deploy:

```bash
./scripts/verify-landing-auth.sh https://idea-impact.com
```

---

## Verification checklist (post-deploy)

```bash
./scripts/verify-landing-auth.sh https://idea-impact.com
curl -fsS https://idea-impact.com/health
curl -fsS 'https://auth.idea-impact.com/realms/platform/.well-known/openid-configuration' | head -c 200
```

**Corp browser (manual):**

1. Open `https://idea-impact.com/` — should redirect straight to Keycloak (no custom login landing).
2. After auth — `/home` loads.
3. On `/home` — no password POST to idea-impact.com except Keycloak on `/realms/*`.

---

## Related

- [auth-keycloak.md](auth-keycloak.md) — Keycloak, OIDC flow, env vars
- [docker-compose.traefik.yml](../docker-compose.traefik.yml) — `/realms` routing
