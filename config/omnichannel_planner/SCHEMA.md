# Omnichannel plan JSON schema

Versioned payloads stored as project uploads with `document_kind = omnichannel_plan` (typically `.json` files).

## Root object

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `version` | integer | yes | Schema version; currently `1`. |
| `project_key` | string | yes | Must match the project the file is uploaded under. |
| `rows` | array | yes | Ordered tactic rows (see below). |

## Row object

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes | Stable row id (UUID recommended). |
| `order` | integer | yes | Sort order (0-based or 1-based; clients should sort ascending). |
| `tactic_library_id` | string (UUID) | yes | FK to `tactics.id` in Postgres. |
| `tactic_key` | string | no | Denormalized library key for display/import resilience. |
| `label_snapshot` | string | no | Cached tactic name at save time. |
| `timing_profile` | string \| null | no | Preferred: id from [`timing_profiles.json`](../scenario_planner/timing_profiles.json). Drives scenario planner scheduling when set. |
| `scenario_tactic` | string \| null | no | **Deprecated** — same validation as `timing_profile`; kept for older plan JSON. Omit or `null` when not used. |
| `notes` | string | no | Free text. |
| `metadata` | object | no | Extension point (e.g. channel overrides). |

## Library integration

Set `tactics.metadata.timing_profile` to a valid profile id so the dashboard defaults timing when adding a row. Legacy: `tactics.metadata.scenario_tactic` is still read as a fallback.

Optional extensions on library rows or `metadata`: `modifier_suggestions` (array of modifier bundle ids), `buy_model`, `audience`, `geo_default`.

## API validation

`POST /api/projects/{project_key}/omnichannel-plans/apply` validates this shape server-side and ensures each `tactic_library_id` exists before attaching/updating `project_tactics`.
