#!/usr/bin/env bash
# Validates multi-replica monitoring and (optionally) concurrent PM runs.
#
# Prerequisites:
#   - Stack reachable at API (default http://localhost:8080)
#   - At least two agent-worker replicas:
#       docker compose up -d --build --scale agent-worker=2
#
# Optional: set PROJECT_KEY to enqueue two PM runs and wait for completion + empty processing queue.

set -euo pipefail
API="${API:-http://localhost:8080}"
export API

echo "smoke-scale: API ${API}"
curl -fsS "${API}/health" >/dev/null

python3 <<'PY'
import json
import os
import sys
import time
import urllib.error
import urllib.request

api = os.environ["API"].rstrip("/")

def get_json(path: str):
    req = urllib.request.Request(f"{api}{path}")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())

d = get_json("/api/monitoring/queues")
if "workers" not in d or not isinstance(d["workers"], list):
    sys.exit("smoke-scale: response missing workers[]")
if "reconcile_last_result" not in d:
    sys.exit("smoke-scale: response missing reconcile_last_result")
q = d.get("queues") or {}
if "ingest_pending_length" not in q:
    sys.exit("smoke-scale: response missing queues.ingest_pending_length")

workers = d["workers"]
ok_hosts = [
    str(w["health"].get("hostname") or "")
    for w in workers
    if w.get("ok") and isinstance(w.get("health"), dict)
]
uniq_hosts = {h for h in ok_hosts if h}
if len(uniq_hosts) < 2:
    print(
        "smoke-scale: need 2+ distinct healthy worker hostnames. "
        "Use: docker compose up -d --scale agent-worker=2 "
        "and set AGENT_WORKER_HEALTH_SAMPLES=4 on agent-api (or comma-separated AGENT_WORKER_URLS).",
        file=sys.stderr,
    )
    sys.exit(2)
print(
    "smoke-scale: worker probes",
    len(workers),
    "distinct healthy hostnames:",
    sorted(uniq_hosts) if uniq_hosts else ok_hosts,
)

pk = os.environ.get("PROJECT_KEY", "").strip()
if not pk:
    print("smoke-scale: monitoring checks OK (set PROJECT_KEY to run dual PM enqueue test)")
    sys.exit(0)

body = {
    "agent_key": "pm",
    "workflow": "general",
    "project_key": pk,
    "input": {"content": "Smoke-scale A: one-line scope check."},
}
ids = []
for label in ("A", "B"):
    body["input"] = {"content": f"Smoke-scale {label}: one-line scope check."}
    req = urllib.request.Request(
        f"{api}/api/runs",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    row = json.loads(urllib.request.urlopen(req, timeout=60).read().decode())
    rid = row.get("run_id")
    if not rid:
        sys.exit(f"smoke-scale: missing run_id for {label}")
    ids.append(str(rid))
print("smoke-scale: enqueued runs", ids)

deadline = time.time() + 180
while time.time() < deadline:
    done = 0
    for rid in ids:
        r = get_json(f"/api/runs/{rid}")
        st = (r.get("status") or "").lower()
        if st in ("completed", "failed", "cancelled", "needs_approval"):
            done += 1
    if done == len(ids):
        break
    time.sleep(2)
else:
    sys.exit("smoke-scale: runs did not finish in time")

m = get_json("/api/monitoring/queues")
proc = (m.get("queues") or {}).get("processing_length")
if proc not in (0, None):
    sys.exit(f"smoke-scale: expected processing_length 0, got {proc}")
print("smoke-scale: dual PM + processing queue OK")
PY

echo "smoke-scale checks passed."
