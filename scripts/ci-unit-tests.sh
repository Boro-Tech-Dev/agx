#!/usr/bin/env bash
# Run Python unit tests for all apps that have a tests/ directory.
# Used locally and in GitHub Actions (see .github/workflows/ci.yml).
set -euo pipefail
cd "$(dirname "$0")/.."

PYTHON="${PYTHON:-python3}"
PYTEST="${PYTEST:-pytest}"

apps=(
  agent-api
  agent-worker
  browser-runner
  ingestion-worker
  model-router
  reranker-colbert
  search-runner
)

for app in "${apps[@]}"; do
  dir="apps/${app}"
  if [[ ! -d "${dir}/tests" ]]; then
    continue
  fi
  echo "==> ${app}"
  (
    cd "${dir}"
    "${PYTHON}" -m pip install -q --upgrade pip
    "${PYTHON}" -m pip install -q "${PYTEST}" httpx
    if [[ -f pyproject.toml ]]; then
      "${PYTHON}" -m pip install -q .
      # Optional dev extras (pytest-asyncio, etc.)
      "${PYTHON}" -m pip install -q '.[dev]' 2>/dev/null || true
    fi
    if [[ "${app}" == "browser-runner" ]]; then
      # DOM integration test needs `playwright install`; unit imports only need pip deps.
      "${PYTHON}" -m "${PYTEST}" tests -q -m "not integration"
    else
      "${PYTHON}" -m "${PYTEST}" tests -q
    fi
  )
done

echo "Python unit tests OK."
