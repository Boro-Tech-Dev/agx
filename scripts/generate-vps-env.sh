#!/usr/bin/env bash
# Generate a fresh production .env for VPS + GitHub secret VPS_DOTENV (never committed).
# Usage: ./scripts/generate-vps-env.sh [output-path]
# Default output: ~/.agent-x-vps.env
set -euo pipefail

OUT="${1:-$HOME/.agent-x-vps.env}"

rand_hex() { openssl rand -hex "$1"; }

POSTGRES_PASSWORD="$(rand_hex 24)"
MINIO_SECRET_KEY="$(rand_hex 24)"
SEARXNG_SECRET_KEY="$(rand_hex 32)"
KEYCLOAK_ADMIN_PASSWORD="$(rand_hex 24)"
# Must match infra/keycloak/realm-platform.json (imported once into keycloak_data).
KEYCLOAK_CLIENT_SECRET="web-dashboard-dev-secret"
MCP_AUTH_TOKEN="$(rand_hex 32)"

umask 077
cat >"$OUT" <<EOF
# Generated $(date -u +"%Y-%m-%dT%H:%M:%SZ") — paste into GitHub secret VPS_DOTENV only.
# Local copy (do not commit): $OUT

# --- GitHub Actions deploy (also written to VPS .env) ---
VPS_HOST=srv1139701.hstgr.cloud
VPS_USER=root
VPS_SSH_PORT=22
VPS_DEPLOY_PATH=/opt/agent-x
VPS_PUBLIC_URL=https://idea-impact.com
APP_PUBLIC_ORIGIN=https://idea-impact.com
GHCR_USERNAME=boro-tech-dev
# Leave empty when GHCR packages are public (default). Set a PAT with read:packages only if pulls return 401.
GHCR_READ_TOKEN=

# --- App ---
APP_ENV=production
PROJECT_NAME=dd-agent-suite

DATABASE_URL=postgresql://dd_agent:${POSTGRES_PASSWORD}@postgres:5432/dd_agents
REDIS_URL=redis://redis:6379/0

OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_NUM_CTX=2048
OLLAMA_PROBE_CHAT=0
OLLAMA_KEEP_ALIVE=5m
MODEL_ROUTER_URL=http://model-router:8085

WEB_SEARCH_ENABLED=1
SEARXNG_URL=http://searxng:8080
SEARXNG_BASE_URL=http://searxng:8080/
SEARXNG_SECRET_KEY=${SEARXNG_SECRET_KEY}
SEARCH_RUNNER_URL=http://search-runner:8092
MCP_BRIDGE_ENABLED=0
MCP_AUTH_TOKEN=${MCP_AUTH_TOKEN}

DEFAULT_PM_MODEL=llama3.1:8b
DEFAULT_SYNERGY_MODEL=llama3.2:3b
DEFAULT_CLINIC_MODEL=llama3.2:3b
DEFAULT_BUILDER_MODEL=qwen2.5:7b
DEFAULT_CODE_MODEL=qwen2.5-coder:7b
DEFAULT_CANON_MODEL=llama3.2:3b
DEFAULT_FORGE_MODEL=llama3.2:3b
DEFAULT_KITT_MODEL=gemma3:270m
DEFAULT_EDDIE_MODEL=deepseek-r1:1.5b
DEFAULT_BUBS_MODEL=tinyllama:1.1b
DEFAULT_EMBED_MODEL=nomic-embed-text

MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
ARTIFACT_BUCKET=dd-agent-artifacts
UPLOAD_BUCKET=dd-agent-uploads

WORKSPACE_ROOT=/workspace
ARTIFACT_ROOT=/artifacts
ALLOW_SHELL_COMMANDS=false
ALLOW_REPO_WRITE=false

RUN_QUEUE=agent.runs
PROCESSING_QUEUE=agent.runs.processing
DEAD_QUEUE=agent.runs.dead
RUN_MAX_ATTEMPTS=2
EMBEDDING_DIM=768
RETRIEVAL_V2_ENABLED=1
WEB_DEEPFETCH_RERANKER_ID=colbert_gte_modern
EMBED_AT_INGEST=nomic-embed-text
RERANK_TEI_TIMEOUT_SEC=30
MODEL_ROUTER_SCHEMA_KEY=1

KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=${KEYCLOAK_ADMIN_PASSWORD}
KEYCLOAK_REALM=platform
KEYCLOAK_CLIENT_ID=web-dashboard
KEYCLOAK_CLIENT_SECRET=${KEYCLOAK_CLIENT_SECRET}
KEYCLOAK_BASE_URL=http://keycloak:8080
KEYCLOAK_ISSUER=https://idea-impact.com/realms/platform

COLBERT_WITH_ML=1
COLBERT_FORCE_STUB=0
EOF

chmod 600 "$OUT"
echo "Wrote $OUT (mode 600)"
echo ""
echo "Before pasting into GitHub:"
echo "  1. Set GHCR_READ_TOKEN only if GHCR packages are private (read:packages PAT)"
echo "     (GitHub → Settings → Developer settings → PAT → read:packages)"
echo ""
echo "Copy into GitHub secret VPS_DOTENV:"
echo "  pbcopy < $OUT"
echo "  # or: gh secret set VPS_DOTENV < $OUT"
echo ""
echo "If Postgres already exists on the VPS with the old password, either:"
echo "  - keep DATABASE_URL matching the running DB, or"
echo "  - wipe postgres volume and redeploy (see docs/auth-keycloak.md)."
