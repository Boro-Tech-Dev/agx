# NetOps ticket: Netskope allowlist for idea-impact.com + auth.idea-impact.com

Copy this request to NetOps / security engineering when deploying the OIDC auth cutover.

## Background

Internal operator dashboard at **https://idea-impact.com** (RagTag). Authentication runs on **https://auth.idea-impact.com** (Keycloak OIDC). Passwords are entered only on the IdP host, not on the dashboard domain.

Corporate Netskope may **Isolate (RBI)** or block traffic when:

- DLP flags minified JS / high-entropy API JSON on the dashboard
- Real-time protection treats custom-domain login patterns as phishing (mitigated by OIDC on auth subdomain)

## Required policies

Apply to **all destinations in the custom URL list below**.

### 1. Custom URL list

| Entry | Value |
|-------|--------|
| Dashboard | `idea-impact.com` |
| Dashboard wildcard | `*.idea-impact.com` |
| IdP (Keycloak) | `auth.idea-impact.com` |

### 2. Traffic steering exception

| Field | Value |
|-------|--------|
| Exception type | Real-Time Protection / Steering Exception |
| Action | Bypass / Direct Routing |
| Destinations | Custom URL list above |
| Reason | Internal engineering dashboard + OIDC IdP; prevents silent drops on `/_next/static` and API payloads |

### 3. SSL decryption exception

| Field | Value |
|-------|--------|
| Rule policy | Do Not Decrypt (DND) |
| Destination | `idea-impact.com`, `*.idea-impact.com`, `auth.idea-impact.com` |
| Reason | Clients must not see Netskope MITM certificates on production TLS |

### 4. DLP / content waiver

If full steering bypass is not approved:

- **Allow high-entropy strings** for compiled UI assets and API JSON on the URL list
- **Raise file scan thresholds** for `.js`, `.map`, `.json` transfers

### 5. Real-time protection — Allow (not Isolate)

| Field | Value |
|-------|--------|
| Action | **Allow** (do not apply Remote Browser Isolation) |
| Destinations | Custom URL list above |
| Reason | Approved internal tools; OIDC credentials collected on `auth.idea-impact.com` only |

### 6. Skope IT recategorization

Recategorize both hostnames from Uncategorized / Newly Observed Domain to **Internal Tools** or **Business** as appropriate.

## Verification after NetOps + deploy

See [netskope-idea-impact-browser.md](netskope-idea-impact-browser.md) and [auth-keycloak.md](auth-keycloak.md).
