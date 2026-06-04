#!/usr/bin/env bash
# Build docker-compose.vps.yml: production port hardening + optional Traefik labels.
set -euo pipefail
cd "$(dirname "$0")/.."

python3 << 'PY'
import yaml
from pathlib import Path

base = yaml.safe_load(Path("docker-compose.yml").read_text())
traefik = yaml.safe_load(Path("docker-compose.traefik.yml").read_text())

no_ports = [
    "agent-api", "postgres", "redis", "minio", "ollama", "model-router",
    "browser-runner", "tool-runner", "searxng", "search-runner",
    "reranker-colbert",
    "agent-worker", "ingestion-worker", "scenario-worker", "veeva-suite-worker",
]
loopback = {
    "keycloak": ["127.0.0.1:8180:8080"],
    "prometheus": ["127.0.0.1:9090:9090"],
    "grafana": ["127.0.0.1:3001:3000"],
}

for svc in no_ports:
    base["services"].get(svc, {}).pop("ports", None)

for svc, ports in loopback.items():
    if svc in base["services"]:
        base["services"][svc]["ports"] = ports

if "minio" in base["services"]:
    env = base["services"]["minio"].setdefault("environment", {})
    if isinstance(env, dict):
        env["MINIO_ROOT_PASSWORD"] = "${MINIO_SECRET_KEY:-minioadmin-dev-only}"

# Keycloak: public HTTPS URL on auth subdomain (survives regen; required for Netskope / form POST).
kc = base["services"].get("keycloak", {})
kc["command"] = [
    "start",
    "--http-enabled=true",
    "--hostname=https://auth.idea-impact.com",
    "--import-realm",
]
kc_env = kc.setdefault("environment", {})
if isinstance(kc_env, dict):
    kc_env.update({
        "KC_HOSTNAME": "https://auth.idea-impact.com",
        "KC_HOSTNAME_STRICT": "true",
        "KC_PROXY_HEADERS": "xforwarded",
        "KC_HTTP_ENABLED": "true",
    })
kc.pop("ports", None)
kc["expose"] = ["8080"]

# web-dashboard: Traefik terminates TLS; no host port publish
wd = base["services"].get("web-dashboard", {})
wd.pop("ports", None)
wd["expose"] = ["3000"]
wd_env = wd.setdefault("environment", {})
if isinstance(wd_env, dict):
    wd_env["APP_PUBLIC_ORIGIN"] = "${APP_PUBLIC_ORIGIN:-${VPS_PUBLIC_URL:-https://idea-impact.com}}"
    wd_env["KEYCLOAK_ISSUER"] = "${KEYCLOAK_ISSUER:-https://auth.idea-impact.com/realms/platform}"
labels = traefik["services"]["web-dashboard"].get("labels", [])
if labels:
    wd["labels"] = labels

Path("docker-compose.vps.yml").write_text(yaml.dump(base, default_flow_style=False, sort_keys=False))
print("Wrote docker-compose.vps.yml")
PY
