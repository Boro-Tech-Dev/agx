#!/usr/bin/env bash
# Run Python unit tests for all apps that have a tests/ directory.
# Used locally and in GitHub Actions (see .github/workflows/ci.yml).
set -euo pipefail
cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"

PYTHON="${PYTHON:-python3}"
PYTEST="${PYTEST:-pytest}"
INSTALL_DEPS="${REPO_ROOT}/scripts/ci_install_pyproject_deps.py"

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
  dir="${REPO_ROOT}/apps/${app}"
  if [[ ! -d "${dir}/tests" ]]; then
    continue
  fi
  echo "==> ${app}"
  (
    cd "${dir}"
    export PYTHONPATH="${dir}${PYTHONPATH:+:${PYTHONPATH}}"
    "${PYTHON}" -m pip install -q --upgrade pip
    "${PYTHON}" -m pip install -q "${PYTEST}" httpx pytest-asyncio
    "${PYTHON}" "${INSTALL_DEPS}" "${dir}"
    if [[ "${app}" == "reranker-colbert" ]]; then
      "${PYTHON}" "${INSTALL_DEPS}" "${dir}" dev
    fi
    if [[ "${app}" == "browser-runner" ]]; then
      "${PYTHON}" -m "${PYTEST}" tests -q -m "not integration"
    else
      "${PYTHON}" -m "${PYTEST}" tests -q
    fi
  )
done

echo "Python unit tests OK."
