# CI/CD (GitHub Actions + GHCR + VPS)

Production deploys use **GitHub Actions** to build images, push to **GHCR**, and roll the VPS stack via SSH. Local and PR validation runs in the **CI** workflow without touching the server.

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| [CI](../.github/workflows/ci.yml) | Push / PR to `main` | Dashboard typecheck + Vitest, Python unit tests, Compose config validation |
| [Build images](../.github/workflows/build-images.yml) | Called by deploy, or manual | Build and push 11 app images to `ghcr.io/boro-tech-dev/agent-x-*` |
| [Deploy VPS](../.github/workflows/deploy-vps.yml) | After CI succeeds on `main`, or manual | Pull images on VPS, `compose up`, health check |

### Automatic deploy path

1. Push merges to `main` → **CI** runs.
2. When CI completes successfully → **Deploy VPS** runs.
3. Deploy builds images tagged `sha-<full-commit-sha>` (and updates `:main`), SSHs to the VPS, runs [`scripts/vps-deploy-registry.sh`](../scripts/vps-deploy-registry.sh).

### Manual deploy

**Actions → Deploy VPS → Run workflow**

| Input | Use |
|-------|-----|
| `image_tag` | Deploy an existing tag (rollback). Example: `sha-abc123...` |
| (empty) | Build current commit and deploy |
| `skip_build` | Only with `image_tag` set — redeploy a tag without rebuilding |

## GitHub secrets (two only)

Same pattern as LandScraper — add under **Settings → Secrets and variables → Actions**:

| Secret | Purpose |
|--------|---------|
| `VPS_SSH_PRIVATE_KEY` | Full private key (`-----BEGIN … KEY-----` through `END …`). Public half in `~/.ssh/authorized_keys` on the VPS for `VPS_USER`. |
| `VPS_DOTENV` | Full production `.env` (generated below; written to the VPS on each deploy) |

**Important:** GitHub secrets are **per repository**. If LandScraper deploy works but **agx** fails with `Permission denied (publickey)`, you must add `VPS_SSH_PRIVATE_KEY` again under **Boro-Tech-Dev/agx → Settings → Secrets**, not only on the LandScraper repo.

**Repo settings:** Actions → General → Workflow permissions → **Read and write** (so `GITHUB_TOKEN` can push images to GHCR).

### SSH troubleshooting

Deploy VPS retries SSH/rsync up to **5 times** (15s–120s backoff), scans host keys on IPv4 then dual-stack, and uses `ConnectTimeout 30` without forcing IPv4-only—see [deploy-vps.yml](../.github/workflows/deploy-vps.yml).

Test from your Mac (same key you paste into GitHub):

```bash
ssh -i ~/.ssh/your_deploy_key -o StrictHostKeyChecking=accept-new root@srv1139701.hstgr.cloud 'echo OK'
```

`VPS_USER` and `VPS_HOST` in `VPS_DOTENV` must match that login. If you use a non-root user, put that user in `VPS_DOTENV` and authorize the key for them.

### Generate `VPS_DOTENV`

```bash
./scripts/generate-vps-env.sh
# → ~/.agent-x-vps.env (mode 600, gitignored path — do not commit)

# 1. Set GHCR_READ_TOKEN in the file (PAT with read:packages)
open -e ~/.agent-x-vps.env

# 2. Copy into GitHub
pbcopy < ~/.agent-x-vps.env
# GitHub → Settings → Secrets → VPS_DOTENV → paste

# or
gh secret set VPS_DOTENV < ~/.agent-x-vps.env
```

Re-run `./scripts/generate-vps-env.sh` anytime to rotate secrets (then update the GitHub secret and redeploy).

## VPS one-time setup

1. Install Docker + Compose v2 plugin.
2. Clone the repo at `/opt/agent-x` (or match `VPS_DEPLOY_PATH` in `VPS_DOTENV`).
3. First boot (swap + volumes + optional on-host build):

   ```bash
   ./scripts/vps-deploy.sh
   ```

4. Add the deploy SSH public key (pair with `VPS_SSH_PRIVATE_KEY`) and ensure the user is in the `docker` group.
5. Host Traefik must already be running (see [docker-compose.traefik.yml](../docker-compose.traefik.yml)).

After CI/CD is configured, routine releases do not require editing `.env` on the host manually — each deploy overwrites it from `VPS_DOTENV`.

## Registry-based deploy (manual)

```bash
cd /opt/agent-x
export IMAGE_TAG=sha-<commit-sha>
export COMPOSE_FILE=docker-compose.vps.yml:docker-compose.traefik.yml:docker-compose.registry.yml
./scripts/vps-deploy-registry.sh
```

## Image names

All app images live under `ghcr.io/boro-tech-dev/`:

- `agent-x-agent-api`
- `agent-x-agent-worker`
- `agent-x-browser-runner`
- `agent-x-ingestion-worker`
- `agent-x-model-router`
- `agent-x-reranker-colbert`
- `agent-x-scenario-worker`
- `agent-x-search-runner`
- `agent-x-tool-runner`
- `agent-x-veeva-suite-worker`
- `agent-x-web-dashboard`

Tags: `sha-<full-git-sha>` (deploy pin), `main` (floating latest on `main`).

## Rollback

1. Find the previous good commit SHA in GitHub.
2. **Actions → Deploy VPS → Run workflow** with `image_tag` = `sha-<that-sha>` and `skip_build` = true.

Or on the VPS:

```bash
export IMAGE_TAG=sha-<previous-sha>
./scripts/vps-deploy-registry.sh
```

## Local CI parity

```bash
./scripts/ci-unit-tests.sh
cd apps/web-dashboard && npm ci && npm run typecheck && npm run test
IMAGE_TAG=local-test docker compose -f docker-compose.yml -f docker-compose.registry.yml config
```

## Related

- [vps-host-setup.md](vps-host-setup.md) — swap, first-time bootstrap, compose files
- [auth-keycloak.md](auth-keycloak.md) — Keycloak / Postgres resets
