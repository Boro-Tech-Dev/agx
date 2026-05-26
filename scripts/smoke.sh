#!/usr/bin/env bash
# Basic API/router/dashboard smoke. For **scaled agent-worker** replicas (distinct hostnames in monitoring),
# use scripts/smoke-scale.sh after `docker compose up -d --scale agent-worker=2` and set AGENT_WORKER_HEALTH_SAMPLES
# on agent-api (or AGENT_WORKER_URLS). Optional: PROJECT_KEY for the dual-PM enqueue leg.
set -euo pipefail
API=${API:-http://localhost:8080}
ROUTER=${ROUTER:-http://localhost:8085}
TOOLS=${TOOLS:-http://localhost:8090}
WEB=${WEB:-http://localhost:3000}

echo "Checking API..."; curl -fsS "$API/health" >/dev/null

echo "Checking GET /api/agents..."
curl -fsS "$API/api/agents" | python3 -c "import json,sys;d=json.load(sys.stdin);assert isinstance(d,list);assert all('key'in x and'name'in x for x in d)if d else True;keys={x.get('key')for x in d};assert not keys or('synergy'in keys and'pm'in keys and'clinic'in keys),keys"

echo "Checking model router..."; curl -fsS "$ROUTER/health" >/dev/null

echo "Checking model router runnable status..."
curl -fsS "$ROUTER/v1/models" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('ok') is True, d; assert d.get('models_ready') is True, d; assert d.get('models_runnable') is True, d"

echo "Checking tool runner..."; curl -fsS "$TOOLS/health" >/dev/null

echo "Checking dashboard..."; curl -fsS "$WEB" >/dev/null

echo "Checking dashboard -> API rewrite..."; curl -fsS "$WEB/health" >/dev/null

STAMP=$(date +%s)
echo "Hierarchy import dry-run (expect validation error)..."
BAD_JSON=$(python3 <<'PY'
import json

print(
    json.dumps(
        {
            'csv_text': 'entity,key,name\nworkspace,9bad,Bad\n',
            'dry_run': True,
            'skip_existing': False,
        }
    )
)
PY
)
BAD_RESP=$(curl -sS -X POST "$API/api/hierarchy/import" -H "Content-Type: application/json" -d "$BAD_JSON")
python3 -c "import json,sys; d=json.loads(sys.argv[1]); assert d.get('ok') is False and d.get('errors'), d" "$BAD_RESP"

echo "Hierarchy import apply (smoke workspace wsimp${STAMP})..."
GOOD_JSON=$(STAMP="$STAMP" python3 <<'PY'
import json
import os

stamp = os.environ['STAMP']
h = 'entity,workspace_key,client_key,brand_key,key,name,description,project_type,pm_kind,project_key,objective,channel,lifecycle_status,start_at,end_at,success_metrics,dependencies,metadata\n'
csv = (
    h
    + f'workspace,,,,wsimp{stamp},Smoke bulk WS,,,,,,,,,,,,,\n'
    + f'client,wsimp{stamp},,,climp{stamp},Smoke bulk client,,,,,,,,,,,,,\n'
    + f'brand,wsimp{stamp},climp{stamp},,brimp{stamp},Smoke bulk brand,,,,,,,,,,,,,\n'
    + f'project,wsimp{stamp},climp{stamp},brimp{stamp},primp{stamp},Smoke bulk project,,other,business,,,,,,,,,\n'
)
print(json.dumps({'csv_text': csv, 'dry_run': False, 'skip_existing': True}))
PY
)
GOOD_RESP=$(curl -fsS -X POST "$API/api/hierarchy/import" -H "Content-Type: application/json" -d "$GOOD_JSON")
python3 -c "import json,sys; d=json.loads(sys.argv[1]); assert d.get('ok') is True, d; c=d.get('created') or {}; assert c.get('projects',0)>=1, d" "$GOOD_RESP"
curl -fsS -X DELETE "$API/api/workspaces/wsimp${STAMP}" >/dev/null
echo "Hierarchy import smoke OK."

if [[ -n "${PROJECT_KEY:-}" ]]; then
  echo "Project document upload (PROJECT_KEY=$PROJECT_KEY)..."
  tmp=$(mktemp)
  printf 'Smoke document line one.\nLine two for chunking.\n' >"$tmp"
  DOC_JSON=$(curl -fsS -X POST "$API/api/projects/$PROJECT_KEY/documents" \
    -F "file=@${tmp};type=text/plain" \
    -F "document_kind=brief")
  rm -f "$tmp"
  export API
  export PROJECT_KEY
  export DOC_JSON
  python3 <<'PY'
import json
import os
import time
import urllib.parse
import urllib.request

row = json.loads(os.environ["DOC_JSON"])
doc_id = row.get("id")
if not doc_id:
    raise SystemExit("upload: missing id in response")
base = os.environ.get("API", "http://localhost:8080").rstrip("/")
pk = urllib.parse.quote(os.environ["PROJECT_KEY"])
ready = False
for _ in range(45):
    req = urllib.request.Request(f"{base}/api/projects/{pk}/documents")
    data = json.loads(urllib.request.urlopen(req, timeout=15).read().decode())
    for d in data:
        if str(d.get("id")) == str(doc_id) and (d.get("processing_status") or "").lower() == "ready":
            ready = True
            break
    if ready:
        break
    time.sleep(1)
if not ready:
    raise SystemExit("upload: document did not reach ready status in time")
req = urllib.request.Request(f"{base}/api/projects/{pk}/documents?kind=brief")
data = json.loads(urllib.request.urlopen(req, timeout=15).read().decode())
if not any(str(d.get("id")) == str(doc_id) for d in data):
    raise SystemExit("list filter by kind=brief missing document")
urllib.request.urlopen(
    urllib.request.Request(
        f"{base}/api/projects/{pk}/documents/{doc_id}",
        data=json.dumps({"document_kind": "changeorder"}).encode(),
        headers={"Content-Type": "application/json"},
        method="PATCH",
    ),
    timeout=15,
).read()
urllib.request.urlopen(
    urllib.request.Request(
        f"{base}/api/projects/{pk}/documents/{doc_id}",
        method="PATCH",
        data=json.dumps({"archived": True}).encode(),
        headers={"Content-Type": "application/json"},
    ),
    timeout=15,
).read()
urllib.request.urlopen(
    urllib.request.Request(f"{base}/api/projects/{pk}/documents/{doc_id}", method="DELETE"),
    timeout=15,
).read()
print("document ingest smoke OK")
PY
fi

if [[ -n "${SMOKE_CONTINUATION:-}" && -n "${PROJECT_KEY:-}" && -n "${PARENT_RUN_ID:-}" ]]; then
  echo "Continuation run (SMOKE_CONTINUATION=1, PARENT_RUN_ID=$PARENT_RUN_ID)..."
  API="$API" PROJECT_KEY="$PROJECT_KEY" PARENT_RUN_ID="$PARENT_RUN_ID" python3 <<'PY'
import json, os, time, urllib.request

api = os.environ["API"].rstrip("/")
pk = os.environ["PROJECT_KEY"]
parent = os.environ["PARENT_RUN_ID"]
body = {
    "agent_key": "pm",
    "workflow": "general",
    "project_key": pk,
    "input": {"content": ""},
    "parent_run_id": parent,
    "reply": "Smoke continuation: clarified scope is QA hardening only.",
    "include_parent_summary": True,
}
req = urllib.request.Request(
    f"{api}/api/runs",
    data=json.dumps(body).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
row = json.loads(urllib.request.urlopen(req, timeout=30).read().decode())
rid = row.get("run_id")
if not rid:
    raise SystemExit("continuation: missing run_id")
for _ in range(60):
    r = json.loads(urllib.request.urlopen(urllib.request.Request(f"{api}/api/runs/{rid}"), timeout=15).read().decode())
    st = (r.get("status") or "").lower()
    if st in ("completed", "degraded", "failed", "cancelled", "needs_approval"):
        print("continuation run finished:", st)
        break
    time.sleep(1)
else:
    raise SystemExit("continuation: run did not finish in time")
PY
  echo "Continuation smoke OK"
fi

if [[ -n "${PROJECT_KEY:-}" ]]; then
  echo "Checking project pm_kind GET/PATCH ($PROJECT_KEY)..."
  python3 <<PY
import json, os, urllib.parse, urllib.request

base = os.environ.get("API", "http://localhost:8080").rstrip("/")
pk = urllib.parse.quote(os.environ["PROJECT_KEY"])
row = json.loads(urllib.request.urlopen(urllib.request.Request(f"{base}/api/projects/{pk}"), timeout=15).read().decode())
k = (row.get("pm_kind") or "").lower()
if k not in ("business", "personal"):
    raise SystemExit(f"GET project: bad pm_kind {k!r}")
req = urllib.request.Request(
    f"{base}/api/projects/{pk}",
    data=json.dumps({"pm_kind": "personal"}).encode(),
    headers={"Content-Type": "application/json"},
    method="PATCH",
)
patched = json.loads(urllib.request.urlopen(req, timeout=15).read().decode())
if (patched.get("pm_kind") or "").lower() != "personal":
    raise SystemExit("PATCH pm_kind=personal did not persist")
req2 = urllib.request.Request(
    f"{base}/api/projects/{pk}",
    data=json.dumps({"pm_kind": "business"}).encode(),
    headers={"Content-Type": "application/json"},
    method="PATCH",
)
urllib.request.urlopen(req2, timeout=15).read()
print("project pm_kind API OK")
PY
fi

SEARCH=${SEARCH:-http://localhost:8092}
echo "Checking search-runner..."; curl -fsS "$SEARCH/health" >/dev/null

echo "Checking GET /api/agent-lanes..."
curl -fsS "$API/api/agent-lanes" | python3 -c "import json,sys;d=json.load(sys.stdin);assert 'agents'in d and len(d['agents'])>=9"

echo "Checking GET /api/admin/retrieval/agents..."
curl -fsS "$API/api/admin/retrieval/agents" | python3 -c "import json,sys;d=json.load(sys.stdin);assert 'agents'in d and 'embedders'in d;rids=[r.get('reranker_id') for r in d.get('rerankers',[])];assert 'colbert_gte_modern' in rids"

ROUTER=${ROUTER:-http://localhost:8085}
echo "Checking model-router /v1/retrieval/catalog..."
curl -fsS "$ROUTER/v1/retrieval/catalog" | python3 -c "import json,sys;d=json.load(sys.stdin);assert len(d.get('embedders',[]))>=4;rids=[r.get('reranker_id') for r in d.get('rerankers',[])];assert 'colbert_gte_modern' in rids"

if curl -fsS "${RERANK_COLBERT:-http://localhost:8097}/health" >/dev/null 2>&1; then
  echo "reranker-colbert health OK"
else
  echo "WARN: reranker-colbert not reachable (optional if ColBERT still starting)"
fi

echo "Smoke checks passed."
