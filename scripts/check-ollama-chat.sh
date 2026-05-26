#!/usr/bin/env bash
set -euo pipefail

OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
MODEL="${MODEL:-qwen2.5-coder:7b}"

echo "Docker memory cap (bytes, from docker info)..."
docker info --format '{{.MemTotal}}' || true

echo
echo "Testing Ollama chat (MODEL=$MODEL, OLLAMA_URL=$OLLAMA_URL)..."

payload=$(
  jq -nc --arg model "$MODEL" --arg msg "Say the word OK." '{
    model: $model,
    stream: false,
    messages: [{role:"user", content:$msg}],
    options: {temperature: 0.0, num_ctx: 2048}
  }'
)

set +e
resp="$(curl -sS -w "\n__HTTP_STATUS__:%{http_code}\n" -H "Content-Type: application/json" -d "$payload" "$OLLAMA_URL/api/chat")"
code="$(printf "%s" "$resp" | awk -F: '/__HTTP_STATUS__/{print $2}' | tr -d '\r')"
body="$(printf "%s" "$resp" | sed '/__HTTP_STATUS__/d')"
set -e

if [[ "$code" != "200" ]]; then
  echo "FAIL: /api/chat returned HTTP $code"
  echo
  echo "Response body (truncated):"
  echo "$body" | head -c 2000 || true
  echo
  echo "Tip: check 'docker compose logs --tail 200 ollama' for 'model requires more system memory'."
  exit 1
fi

content="$(printf "%s" "$body" | jq -r '.message.content // empty' 2>/dev/null || true)"
echo "OK: /api/chat succeeded."
echo "Model output (truncated): ${content:0:200}"

