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

# web-dashboard: Traefik terminates TLS; no host port publish
wd = base["services"].get("web-dashboard", {})
wd.pop("ports", None)
wd["expose"] = ["3000"]
labels = traefik["services"]["web-dashboard"].get("labels", [])
if labels:
    wd["labels"] = labels

Path("docker-compose.vps.yml").write_text(yaml.dump(base, default_flow_style=False, sort_keys=False))
print("Wrote docker-compose.vps.yml")
PY
