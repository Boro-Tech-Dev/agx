# Agent lanes (Tool-capable, Pre-fetch only, Reasoning)

RagTag assigns every agent a **lane** that explains how it uses tools and which local model backs it.

## Lanes

| Lane | Label | Who |
|------|--------|-----|
| `tool_capable` | **Tool-capable** | PM, Builder, Forge, Canon |
| `prefetch_only` | **Pre-fetch only** | Synergy, Clinic, KITT, Bubs |
| `reasoning_no_tools` | **Reasoning (no tools)** | Eddie |

### Tool-capable

- Default models: `llama3.1:8b` (PM/HAL), `qwen2.5:7b` (Builder), `llama3.2:3b` (Forge, Canon).
- Can run an **autonomous tool loop** when `input.use_tools=true` on a run.
- Flow: model-router `POST /v1/route_with_tools` → Ollama with `tools=[...]` → HTTP Tool Registry → **second pass** with JSON schema `format` for structured output.
- Tools: web search (SearXNG), URL read/extract, and (Builder) repo search/read/summarize.

### Pre-fetch only

- Synergy/Clinic use `llama3.2:3b`; KITT/Bubs use compact models (`gemma3:270m`, `tinyllama:1.1b`). Lighter `llama3.2:1b` remains available for constrained hosts.
- The worker may **pre-fetch** web search (`input.web_search=true`) and inject `## Web_search_facts` before the model call.
- The model does **not** invoke tools itself.

### Reasoning (no tools)

- Eddie uses `deepseek-r1:1.5b` for deliberation-style output without tool calling.
- Optional pre-fetch web search per run.

## Web search (SearXNG)

- Private **SearXNG** service in Compose (`searxng` + `search-runner`).
- **Outbound network**: queries are sent to public search engines via your instance.
- Kill-switch: `WEB_SEARCH_ENABLED=0` in `.env`.
- Dashboard: **Tools → Web Search**.
- JSON API must be enabled in `infra/searxng/settings.yml` (`search.formats` includes `json`).

## MCP profile (optional)

External MCP clients (Cursor, Claude Desktop) can use the same SearXNG:

```bash
docker compose --profile mcp up -d searxng mcp-searxng
```

Set `MCP_BRIDGE_ENABLED=1` and `MCP_BRIDGE_TARGETS` on `model-router` to bridge MCP tools into the registry (advanced). Start the sidecar with `docker compose --profile mcp up -d mcp-searxng`. Hardened HTTP mode requires `MCP_AUTH_TOKEN` plus `MCP_HTTP_ALLOWED_ORIGINS` (see compose defaults).

## API

- `GET /api/agent-lanes` — lane catalog for the dashboard.
- `POST /api/web/search` — operator search (proxied to search-runner).

## Opt-in flags on runs

| Input field | Effect |
|-------------|--------|
| `web_search` | Pre-fetch SearXNG snippets into the prompt |
| `use_tools` | Tool-capable agents only: autonomous tool loop |

Forge and Canon default `web_search` on; others default off.

## Retrieval playground (Phase 10)

Per-agent **embedder** and **reranker** selection is stored in Postgres (`agent_retrieval_config`) and editable at **Dashboard → Models → Retrieval playground** (`/admin/retrieval`).

| Embedder (Ollama) | Dim | Notes |
|-------------------|-----|--------|
| `nomic-embed-text` | 768 | Default |
| `embeddinggemma` | 768 | Drop-in alternative |
| `mxbai-embed-large` | 1024 | Stronger recall; backfill required |
| `bge-m3` | 1024 | Multilingual; backfill required |

| Reranker | Backend | Used for |
|----------|---------|----------|
| `off` | — | RRF order only |
| `colbert_gte_modern` | `reranker-colbert:8097` | **Default** — tool-capable agents + web deep-fetch (GTE Modern v1) |
| `colbert_jina_v2` | `reranker-colbert:8097` | ColBERT Jina v2 multilingual (`COLBERT_MODEL` on sidecar) |
| `ollama_mxbai_rerank` | Ollama | LLM-as-reranker |
| `ollama_qwen3_rerank` | Ollama | Smaller LLM reranker |

The default Compose stack is **ColBERT-only** (`reranker-colbert` on port 8097). Catalog rows `tei_bge` / `tei_jina` remain in Postgres for reference but are **disabled** (`enabled = false`).

ColBERT sets `HF_HOME=/data/hf` on volume `reranker_colbert_hf` so model weights persist across container recreates. First boot may take several minutes while weights download (~600 MB).

**Tool-capable** agents (`pm`, `builder`, `forge`, `canon`) default to `colbert_gte_modern` and use `retrieval_v2`: keyword + vector over-fetch → RRF → optional rerank. Other agents keep legacy `hybrid_memory` but still respect per-agent embedder for vector search when enabled.

### Optional TEI cross-encoders (not in default Compose)

For GPU or large-RAM hosts, you can run TEI sidecars manually using [`infra/docker/tei-reranker.Dockerfile`](../infra/docker/tei-reranker.Dockerfile) and [`infra/docker/tei-reranker-entrypoint.sh`](../infra/docker/tei-reranker-entrypoint.sh). On **AMD CPU**, use ONNX exports (`newtechstudio/bge-reranker-v2-m3-onnx`, `BAAI/bge-reranker-base`). Re-enable `tei_*` rows in the retrieval playground after TEI is reachable.

### Run-page reranker (tool-capable agents)

On each tool-capable agent page (`/agents/pm`, etc.), **Memory reranker (this run)** sits alongside **Use tools** and **Pre-fetch web search**:

| UI choice | Sent in run `input` | Effect |
|-----------|---------------------|--------|
| Agent default | *(omit `reranker_override`)* | Uses `agent_retrieval_config.reranker_id` from the retrieval playground |
| Off (RRF only) | `reranker_override: "off"` | Skip rerank for this run |
| Any catalog reranker | `reranker_override: "<id>"` | One-run A/B without changing playground defaults |

Existing databases: [`scripts/apply-retrieval-seeds.sh`](../scripts/apply-retrieval-seeds.sh) (also run at the end of `./scripts/vps-deploy.sh`) applies [`infra/postgres/init/032_colbert_only.sql`](../infra/postgres/init/032_colbert_only.sql).

### Run input overrides (single-run A/B)

| Input field | Effect |
|-------------|--------|
| `embedder_override` | Use this embedder for one run only |
| `reranker_override` | Use this reranker for one run only |

### Backfill

After enabling a new embedder, run **Backfill** on `/admin/retrieval` or `POST /api/admin/retrieval/embed/backfill` (SSE). Ingest defaults: `EMBED_AT_INGEST=nomic-embed-text,embeddinggemma`.

### Eval

```bash
python scripts/retrieval_eval.py
```

Writes `artifacts/retrieval_eval/<timestamp>.{json,md}`.
