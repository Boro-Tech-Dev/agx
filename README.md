# DD Agent Suite

Local-first Ollama-powered operator suite with nine agents:

- **PM (`pm`)** — business project breakdowns, tasks, risks, status artifacts.
- **Synergy** — personal / creative organizing (lyrics, collections, life projects); use for `pm_kind=personal` projects instead of `pm`.
- **H.E.L.P.eR (`clinic`)** — health-record text organization (visit summaries, lab/imaging **report** text); informational only, not a substitute for licensed care. Use document kinds `clinical_note`, `lab_report`, `imaging_report` on uploads where appropriate.
- **Builder** — repo inspection, implementation plans, patch artifacts.
- **Twiki (`canon`)** — shared memory, decisions, retrieval, canonical knowledge.
- **Forge** — scored opportunity and innovation generation.
- **KITT (`kitt`)** — compact business breakdowns; business projects only. Dashboard input matches HAL9000 (free-form paste plus the same registry opt-ins). Default chat model is **`gemma3:270m`** (distinct from HAL / PM); override with **`DEFAULT_KITT_MODEL`** if needed. **`KITT_ROUTER_GRAMMAR_MODE`** (model-router, default **`never`**) controls Ollama JSON grammar for KITT—see [`docs/local_llm.md`](docs/local_llm.md). Output schema differs from HAL.
- **Eddie (`eddie`)** — opportunity scans with a reasoning-oriented default model (DeepSeek-R1–class).
- **Bubs (`bubs`)** — lightweight personal-mode breakdowns (TinyLlama-class); personal projects only.

The dashboard loads the agent grid from `GET /api/agents`. Fresh databases get the built-in agents from [`infra/postgres/schema.sql`](infra/postgres/schema.sql) (Compose mounts this on first Postgres init).

Existing databases created before clinical document kinds: apply [`infra/postgres/init/008_document_kind_clinical.sql`](infra/postgres/init/008_document_kind_clinical.sql) once so `clinical_note` / `lab_report` / `imaging_report` are allowed on `source_documents`.

**Imaging uploads (PNG/JPEG/WebP):** files are accepted and indexed with a short placeholder chunk so they appear in project memory; there is no radiology pixel model in the stack yet—paste report text or describe the study in **H.E.L.P.eR** for useful synthesis. Native DICOM is not supported in this release.

To **re-upsert** the catalog on an existing volume (e.g. after editing agent rows in SQL), run [`./scripts/apply-agents-catalog.sh`](./scripts/apply-agents-catalog.sh) or apply [`infra/postgres/seeds/agents_catalog.sql`](infra/postgres/seeds/agents_catalog.sql) manually.

**Scenario planner / tactic library:** Cadence options in the dashboard come from repo [`config/scenario_planner/timing_profiles.json`](config/scenario_planner/timing_profiles.json) (no Postgres required). Named rows in **Workspaces → tactic library** and `/api/tactics` come from Postgres. If the library is empty on an **existing** database volume, run [`./scripts/apply-tactic-library-seed.sh`](./scripts/apply-tactic-library-seed.sh) with `DATABASE_URL` set (same pattern as other seed scripts). To upsert only the three **HappyGuy MAD** tactics, apply [`infra/postgres/seeds/005_happyguy_mad_tactics.sql`](infra/postgres/seeds/005_happyguy_mad_tactics.sql). The **agent-worker** image copies `config/scenario_planner` so scenario compute matches the dashboard for every timing profile id.

This scaffold follows the architecture in `docs/architecture.md`. For **horizontal worker replicas**, queue metrics, and capacity notes, see [`docs/scaling.md`](docs/scaling.md). **Prometheus + Grafana** (ports `9090` and `3001`) start with the main Compose file; see the “Self-hosted metrics” section in `docs/scaling.md`.

**Python sources** for `agent-api` and `agent-worker` live under `apps/*/app/` and `apps/*/worker/` respectively. Ignore any `apps/*/build/` trees—those are stale packaging artifacts, not the source of truth (see `.gitignore`).

## Quick Start

```bash
cp .env.example .env
./scripts/compose-up.sh -d postgres redis minio ollama
# One-shot pull of default models (large download; re-run anytime):
docker compose run --rm ollama-pull
./scripts/compose-up.sh -d --build
```

Prefer **`./scripts/compose-up.sh`** over raw `docker compose up`: it runs reclaim first (`docker compose rm -f` plus removal of **`Created`** project containers) so a partial `up` cannot leave stale names on the next run. Use **`./scripts/compose-down.sh`** for teardown (same cleanup after `down`).

### If runs show `degraded` (Ollama 500s)

If the dashboard shows runs with status **`degraded`**, check the Ollama container logs. A common cause is **insufficient Docker Desktop memory** to load `qwen2.5-coder:7b` (you may see “model requires more system memory … available …” and `/api/chat` returning HTTP 500).

- **Docker Desktop → Settings → Resources → Memory**:
  - If your host has **16GB RAM**: set Docker memory to **8–10GB**.
  - If your host has **8GB RAM**: set Docker memory to **6–7GB**. Observability (Prometheus/Grafana) is off by default; enable with `docker compose --profile observability up -d` when you need metrics.
- Apply the change and restart Docker Desktop.
- Recreate the stack so the new memory limit applies: `./scripts/compose-up.sh -d --build`
- Validate with: `./scripts/check-ollama-chat.sh`

For **timeouts, `/v1/models` probes, `OLLAMA_NUM_CTX`, timeline routing, and `run_events` taxonomy**, see [`docs/local_llm.md`](docs/local_llm.md). If agent runs and the Models page compete for Ollama, set **`OLLAMA_PROBE_CHAT=0`** on model-router so `/v1/models` uses tag presence only (see that doc).

If you still see 500s (or you prefer lower resource usage), switch to a smaller default model by editing `.env` and restarting:

- Pick a model that fits your machine (list installed): `docker compose exec ollama ollama list`
- Example “lighter” pulls (choose one): `llama3.2:1b`, `llama3.2:3b`, `qwen2.5-coder:3b`, `qwen2.5:3b`
- Default tiers: HAL (PM) `llama3.1:8b` (~6–10 GB); Builder `qwen2.5:7b` (~5–8 GB); Forge/Canon/Synergy/Clinic `llama3.2:3b` (~3–4 GB each). Concurrent 8B + 7B may need ~12–18 GB—use `OLLAMA_KEEP_ALIVE=5m` on tight hosts.
- Set `DEFAULT_PM_MODEL=<your_model>`
- Set `DEFAULT_CODE_MODEL=<your_model>`
- Restart: `./scripts/compose-up.sh -d --build`
- Re-validate: `MODEL=<your_model> ./scripts/check-ollama-chat.sh`

## Fresh database (wipe + recreate)

The Postgres schema is created from a single canonical bootstrap file:

- `infra/postgres/schema.sql`

To redeploy with a clean database:

```bash
./scripts/compose-down.sh -v
./scripts/compose-up.sh -d postgres
./scripts/compose-up.sh -d --build
```

If you prefer pulling inside the Ollama container: `docker compose exec ollama ollama pull llama3.1:8b` (and `qwen2.5:7b`, `llama3.2:3b`, `nomic-embed-text`, plus optional embedders `embeddinggemma`, `mxbai-embed-large`, `bge-m3` — see `scripts/ollama-warm-models.sh`). Reranking uses the ColBERT sidecar (`reranker-colbert` on port 8097); see [`docs/agent-lanes.md`](docs/agent-lanes.md).

Open the dashboard at `http://localhost:3000`, or from another machine on your LAN at `http://<this-host-LAN-IP>:3000`. The UI talks to the API through Next.js on port 3000 (same-origin rewrites to `agent-api`); rebuild the `web-dashboard` image after changing [`apps/web-dashboard/next.config.js`](apps/web-dashboard/next.config.js).

### Tools (including Learning)

Specialist tools live under **Tools** in the dashboard (`/tools`), not under Operations. The catalog includes ten entries (Ask Clarifier, Brief Generator, Launchpad, Learning, Omnichannel Planner, Reply Coach, Scenario Planner, Veeva Suite, Web Capture, **Web Search**). **Learning** (`/tools/learning`) covers pharma literacy, role playbooks, and optional brand training—see [`AGENT_DO_NOT_READ/docs/learning-platform.md`](AGENT_DO_NOT_READ/docs/learning-platform.md). Apply [`infra/postgres/init/022_learning.sql`](infra/postgres/init/022_learning.sql) and [`infra/postgres/seeds/learning_workspace.sql`](infra/postgres/seeds/learning_workspace.sql) on existing databases.

### Agent lanes (Tool-capable, Pre-fetch only, Reasoning)

Each agent shows a **lane badge** in the dashboard (agent pages, run detail, monitoring). See [`docs/agent-lanes.md`](docs/agent-lanes.md).

- **Tool-capable** (PM/HAL, Builder, Forge, Canon): HAL `llama3.1:8b`, Builder `qwen2.5:7b`, Forge/Canon `llama3.2:3b`; optional autonomous tool loop via `input.use_tools=true`.
- **Pre-fetch only** (Synergy, Clinic, KITT, Bubs): Synergy/Clinic `llama3.2:3b`; KITT/Bubs stay compact; optional `input.web_search=true` injects SearXNG snippets before the model call.
- **Reasoning** (Eddie): `deepseek-r1:1.5b`; no tool loop.

### Web search via SearXNG

Compose starts **searxng** (port `8888` in dev) and **search-runner**. Queries leave your network to public engines (private metasearch). Disable with `WEB_SEARCH_ENABLED=0`. Verify JSON: `curl 'http://localhost:8888/search?q=test&format=json'`. Tool-capable agents can search autonomously when **Use tools** is checked; all agents can use **Pre-fetch web search**.

## Current State

This is a wired starter scaffold. The API services include basic health endpoints and route placeholders. The next implementation pass should wire persistence, queues, model calls, ingestion, and artifact generation.

## Phase 03 Status

This package includes the Phase 03 buildout: run events, project items, formatted artifacts, model status, repo search/manifest tools, dashboard pages for model/workspaces/run detail, and deterministic fallback outputs when Ollama is unavailable.

## PM run continuation (reply / converse)

When a PM, Synergy, or H.E.L.P.eR run finishes with `open_questions`, you can **queue a follow-up run** that stitches the parent run’s summary and questions into the next model request.

- **Dashboard**: on `/agents/pm`, `/agents/synergy`, or `/agents/clinic`, after a completed run with open questions, use **Continue as new … run**, or open **Workspaces → Project items** and use the row **Actions** menu (e.g. **Ask a question (PM follow-up)**) — deep-links use `?parent_run=<uuid>&project_key=<key>&project_item_id=<uuid>` (and optional `continuation_seed=…` for a prefilled continuation reply); personal projects link to Synergy.
- **Project registry (automatic)**: For `agent_key` in `pm`, `synergy`, `clinic`, `kitt`, or `bubs`, when `project_key` is set the **worker** prepends a `## Project_registry_facts` section built from Postgres. **PM (`pm`) or KITT (`kitt`) first run** (no `parent_run_id`) defaults to a **minimal** snapshot: project profile plus optional **Focus_project_item** only—no uploaded timeline table and no open tasks/risks/items—so your request text is not buried. Use the dashboard checkboxes to opt in to **timeline key dates** and/or **open project items**, or set `input.include_registry_timeline` / `input.include_registry_open_items` on `POST /api/runs`. **Continuation runs** include the full registry (timeline + open items) unless you override those flags. Synergy, Bubs, and H.E.L.P.eR first passes are unchanged (full open-item list and timeline). Only **PM** and **KITT** first runs use the minimal defaults above.
- **Focused project item (optional)**: Pass `input.focus_project_item_id` (UUID of any non–timeline `project_items` row for that project, e.g. task, risk, `open_question`). The API validates the row; the worker adds a **Focus_project_item** subsection (includes `item_type`). The dashboard sets this from **Project items** actions (e.g. follow-up with focus, or **Discuss in PM** for a new run).
- **API**: `POST /api/runs` with optional `parent_run_id` (UUID), `reply` (string), and `include_parent_summary` (boolean, default `true`). The child run’s `input.content` is treated as an optional **New request** section; at least one of `reply` or `input.content` must be non-empty. Rows gain `parent_run_id` / `conversation_id` in Postgres (defined in [`infra/postgres/schema.sql`](infra/postgres/schema.sql)).
- **Item status / metadata / title**: `PATCH /api/projects/{project_key}/items/{item_id}` with `{"status":"resolved"}` or `{"status":"open"}` or `{"metadata":{…}}` (JSON merged) or `{"title":"…"}` (non-empty, up to 500 chars). Used by **Resolve**, **Reopen**, **Flag**, and **Edit summary** in Workspaces **Project items**.

## Delivery scenario (timeline CSV)

On **`/agents/pm`**, business projects can include an optional structured **`input.scenario`** on `POST /api/runs`. The **worker** parses the timeline, injects a `## Delivery_scenario_facts` markdown table into the model request (each row: task, start date, end date, note), and echoes **`output.scenario_snapshot`** (version 2) for auditability. **PM** still outputs the usual JSON (tasks, risks, and so on) and must not contradict the supplied step dates.

- **Basis:** calendar dates per row (`YYYY-MM-DD`). Each row’s **End Date** must be on or after **Start Date**.
- **Shape:** `input.scenario` is a JSON object with either **`csv_text`** (string: full CSV body) or **`steps`** (array of `{ "task", "start_date", "end_date", "note?" }`). If both are set, **`steps` wins** (see [`apps/agent-worker/worker/scenario_planning.py`](apps/agent-worker/worker/scenario_planning.py)).
- **CSV columns:** **`Task`**, **`Start Date`**, **`End Date`**, optional **`Note`**. Header matching is case- and space-insensitive. UTF-8 with optional BOM is accepted.
- **API:** Invalid `scenario` objects for `agent_key: pm` return **400** with validation detail (see [`apps/agent-api/app/schemas/hal_scenario.py`](apps/agent-api/app/schemas/hal_scenario.py)).
- **Disclaimer:** The timeline is a planning aid only—not legal, regulatory, or MLR advice.

## Work kind (business vs personal)

Each project has `pm_kind` in Postgres: `business` or `personal`. Set it when creating a project or under **Workspaces → Current project → Work kind**. **Business** projects use **PM (`agent_key: pm`)** with the business breakdown schema. **Personal** projects use **Synergy (`agent_key: synergy`)** with the personal schema; the API returns `400` if you try to queue `pm` on a personal project.

Example curl (continuation on a business PM run):

```bash
curl -sS -X POST "${API:-http://localhost:8080}/api/runs" \
  -H "Content-Type: application/json" \
  -d "{\"agent_key\":\"pm\",\"workflow\":\"breakdown\",\"project_key\":\"$PROJECT_KEY\",\"input\":{\"content\":\"Proceed with the spike once clarified.\"},\"parent_run_id\":\"$PARENT_RUN_ID\",\"reply\":\"Owner: platform team. Deadline: next Friday.\",\"include_parent_summary\":true}"
```

Personal project follow-up (use `workflow` `breakdown` to match the dashboard):

```bash
curl -sS -X POST "${API:-http://localhost:8080}/api/runs" \
  -H "Content-Type: application/json" \
  -d "{\"agent_key\":\"synergy\",\"workflow\":\"breakdown\",\"project_key\":\"$PROJECT_KEY\",\"input\":{\"content\":\"Here is more context.\"}}"
```

## Project types and log-only capture

Every project has a **`project_type`** from a fixed catalog (see **`GET /api/projects/project-types`**). Types marked **`capture_mode: log_only`** (journal, health/activity log, media log, quotes, metrics, general inbox) **do not** run breakdown agents (`pm`, `synergy`, `clinic`, `kitt`, `bubs`) or persist structured **`project_items`** unless **`metadata.allow_structured_breakdown`** is **true** on the project.

- **Create project**: `POST /api/projects` requires **`project_type`** (catalog slug) and accepts optional **`metadata`** (e.g. `{ "allow_structured_breakdown": true }`).
- **Dashboard**: **Workspaces → New project** includes a project-type select and optional “Allow structured breakdown”. **Current project** card edits work kind, project type, and that flag. **Home → Quick log** saves **`memories`** as notes for log-only projects.
- **Hierarchy CSV**: each **`project`** row must include a valid **`project_type`** slug (same catalog).
- **Existing databases**: apply [`infra/postgres/init/010_project_type_catalog.sql`](infra/postgres/init/010_project_type_catalog.sql) once so `projects.project_type` is backfilled, **NOT NULL**, and **CHECK**-constrained to the catalog.
