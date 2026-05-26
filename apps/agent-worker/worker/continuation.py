import json

from worker.db import fetch_one

MAX_SECTION = 10000


def _trunc(s: str, n: int) -> str:
    if len(s) <= n:
        return s
    return s[: n - 24] + '\n...[truncated]...\n'


def compose_user_content(inp: dict) -> str:
    """Single user blob for context_messages; expands parent run into sections when parent_run_id set."""
    pid = inp.get('parent_run_id')
    if not pid:
        return inp.get('content') or inp.get('prompt') or json.dumps(inp)
    parent = fetch_one(
        'select output, input, id::text from agent_runs where id=%s::uuid',
        (str(pid),),
    )
    if not parent:
        return inp.get('content') or inp.get('prompt') or json.dumps(inp)
    include = inp.get('include_parent_summary', True)
    parts: list[str] = []
    if include:
        out = parent.get('output')
        if isinstance(out, str):
            try:
                out = json.loads(out)
            except Exception:
                out = {}
        if not isinstance(out, dict):
            out = {}
        summary = (out.get('summary') or '')[:4000]
        pq = out.get('open_questions') or []
        if not isinstance(pq, list):
            pq = []
        bullets: list[str] = []
        for q in pq[:40]:
            if isinstance(q, dict):
                line = str(q.get('question') or q.get('title') or q)[:500]
            else:
                line = str(q)[:500]
            if line.strip():
                bullets.append(f'- {line.strip()}')
        prior_pin = parent.get('input') or {}
        if isinstance(prior_pin, str):
            try:
                prior_pin = json.loads(prior_pin)
            except Exception:
                prior_pin = {}
        prior_req = ''
        if isinstance(prior_pin, dict):
            prior_req = str(prior_pin.get('content') or prior_pin.get('prompt') or '')[:3000]
        block = f'Parent run id: {parent["id"]}\nOriginal request (excerpt):\n{prior_req}\n\nSummary:\n{summary}\n'
        if bullets:
            block += '\nOpen questions from parent:\n' + '\n'.join(bullets) + '\n'
        parts.append('## Prior_run\n' + _trunc(block, MAX_SECTION))
    reply = (inp.get('reply') or '').strip()
    if reply:
        parts.append('## Your_reply\n' + _trunc(reply, MAX_SECTION))
    new_req = (inp.get('content') or inp.get('prompt') or '').strip()
    if new_req:
        parts.append('## New_request\n' + _trunc(new_req, MAX_SECTION))
    return '\n\n'.join(parts) if parts else json.dumps(inp)
