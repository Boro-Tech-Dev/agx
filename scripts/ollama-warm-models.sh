#!/bin/sh
# Wait for Ollama, then pull models used by model-router defaults.
# Uses the official `ollama` CLI against the compose `ollama` service (OLLAMA_HOST),
# so pull success/failure matches real usage (curl streaming to /dev/null was unreliable).
set -u

OLLAMA_URL="${OLLAMA_BASE_URL:-http://ollama:11434}"
OLLAMA_URL="${OLLAMA_URL%/}"
export OLLAMA_HOST="$OLLAMA_URL"

PM="${DEFAULT_PM_MODEL:-llama3.1:8b}"
FORGE="${DEFAULT_FORGE_MODEL:-llama3.2:3b}"
CANON="${DEFAULT_CANON_MODEL:-llama3.2:3b}"
# Builder (Bot the Builder) default in model-router: DEFAULT_BUILDER_MODEL → DEFAULT_CODE_MODEL → qwen2.5:7b
BUILDER="${DEFAULT_BUILDER_MODEL:-${DEFAULT_CODE_MODEL:-qwen2.5:7b}}"
EMBED="${DEFAULT_EMBED_MODEL:-nomic-embed-text}"
KITT="${DEFAULT_KITT_MODEL:-gemma3:270m}"
EDDIE="${DEFAULT_EDDIE_MODEL:-deepseek-r1:1.5b}"
BUBS="${DEFAULT_BUBS_MODEL:-tinyllama:1.1b}"

echo "Waiting for Ollama at ${OLLAMA_HOST}..."
n=0
while ! ollama list >/dev/null 2>&1; do
  n=$((n + 1))
  if [ "$n" -gt 90 ]; then
    echo "Ollama not ready after ~3m; exiting without pulls."
    exit 0
  fi
  sleep 2
done

pull_one() {
  name="$1"
  max_attempts="${OLLAMA_PULL_ATTEMPTS:-5}"
  pause="${OLLAMA_PULL_RETRY_PAUSE:-45}"
  attempt=0
  while [ "$attempt" -lt "$max_attempts" ]; do
    attempt=$((attempt + 1))
    echo "Pulling ${name} (attempt ${attempt}/${max_attempts})..."
    if ollama pull "$name"; then
      echo "Done: ${name}"
      return 0
    fi
    echo "Pull failed for ${name}; retrying in ${pause}s (partial data is reused)."
    sleep "$pause"
  done
  echo "Warning: gave up on ${name} after ${max_attempts} attempts — run: docker compose run --rm ollama-pull"
  return 1
}

pull_one "$PM"
pull_one "$FORGE"
pull_one "$CANON"
pull_one "$BUILDER"
pull_one "$EMBED"
# Phase 10 embedder playground (default on in dev)
if [ "${EMBED_WARM_GEMMA:-1}" != "0" ]; then pull_one "embeddinggemma"; fi
if [ "${EMBED_WARM_MXBAI:-1}" != "0" ]; then pull_one "mxbai-embed-large"; fi
if [ "${EMBED_WARM_BGE:-1}" != "0" ]; then pull_one "bge-m3"; fi
if [ "${RERANK_OLLAMA_ENABLED:-1}" != "0" ]; then
  pull_one "mxbai-rerank-large-v2"
  pull_one "qwen3-reranker:0.6b"
fi
pull_one "$KITT"
pull_one "$EDDIE"
pull_one "$BUBS"
echo "Ollama warm-up finished."
