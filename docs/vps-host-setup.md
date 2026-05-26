# VPS host setup (swap)

The agent-x stack is memory-heavy on a single host (Ollama with long `OLLAMA_KEEP_ALIVE`, ColBERT reranker, Playwright runners, Postgres/pgvector). **Swap is configured on the Linux host**, not in Docker images or Compose files. Containers use host swap automatically once it exists.

After the ColBERT-only compose change, expect **~26 GiB less** resident RAM than when two TEI rerankers (`reranker-bge`, `reranker-jina`) ran alongside ColBERT. Optional host `.env`: `OLLAMA_KEEP_ALIVE=5m` to unload models sooner on 32 GiB VPS hosts.

For Ollama memory errors and model sizing, see [README.md](../README.md) (“If runs show `degraded`”) and [.env.example](../.env.example) (`OLLAMA_NUM_CTX`).

## Deploy entry points

### CI/CD (production, after setup)

GitHub Actions builds images to GHCR and deploys via SSH. See **[ci-cd.md](ci-cd.md)** for setup (two secrets: `VPS_SSH_PRIVATE_KEY` + `VPS_DOTENV`), rollback, and workflow details.

On the VPS, registry deploys use:

```bash
export COMPOSE_FILE=docker-compose.vps.yml:docker-compose.traefik.yml:docker-compose.registry.yml
export IMAGE_TAG=sha-<commit-sha>   # set by CI
./scripts/vps-deploy-registry.sh
```

### First-time bootstrap (swap + on-host build)

From the VPS checkout (e.g. `/opt/agent-x`):

```bash
./scripts/vps-deploy.sh
```

This runs, in order:

1. `sudo ./scripts/setup-swap.sh` — ensure **64 GB** swap (default), replacing smaller existing swap
2. `./scripts/generate-vps-compose.sh` — refresh `docker-compose.vps.yml`
3. `./scripts/compose-up.sh -d --build` — bring up the stack with `COMPOSE_FILE=docker-compose.vps.yml:docker-compose.traefik.yml`
4. `./scripts/apply-retrieval-seeds.sh` — idempotent ColBERT-only retrieval catalog + per-agent defaults in Postgres

Pass extra arguments to skip the default and target specific services:

```bash
./scripts/vps-deploy.sh -d agent-api
```

After CI/CD is configured, routine releases use `vps-deploy-registry.sh` (no swap step, no on-host `docker build`).

## Swap only (no Compose)

```bash
sudo ./scripts/setup-swap.sh
```

## Environment overrides

| Variable | Default | Purpose |
|----------|---------|---------|
| `SWAP_SIZE_GB` | `64` | Swap file size in gigabytes |
| `SWAP_FILE` | `/swapfile` | Path to the swap file |
| `SWAPPINESS` | `10` | `vm.swappiness` (lower = prefer RAM over swap) |

Example:

```bash
sudo SWAP_SIZE_GB=64 SWAPPINESS=10 ./scripts/setup-swap.sh
```

## Verify

```bash
free -h
swapon --show
```

Expect roughly **64G** in the swap line after a successful run.

## Persistence and stack resets

- Swap is stored in `/swapfile` and `/etc/fstab`; it **survives reboot** and **Docker volume wipes** (Keycloak/Postgres reset in [auth-keycloak.md](auth-keycloak.md) does not remove swap).
- Replacing swap briefly runs `swapoff -a`; run during a maintenance window if the box is under heavy load.

## Related

- [ci-cd.md](ci-cd.md) — GitHub Actions, GHCR images, secrets, rollback
- [auth-keycloak.md](auth-keycloak.md) — VPS Keycloak reset and ordered bring-up
- [docker-compose.traefik.yml](../docker-compose.traefik.yml) — TLS / Traefik labels for idea-impact.com
