# Learning playbook schema (v1)

Playbooks are versioned JSON under `config/learning/`. The agent-api loader merges optional brand overlays from `config/learning/brands/`.

## Root fields

| Field | Type | Required |
| --- | --- | --- |
| `id` | string | yes |
| `version` | integer | yes |
| `module_type` | `pharma_knowledge` \| `role_playbook` | yes |
| `title` | string | yes |
| `estimatedMinutes` | integer | no |
| `agency_role` | `account_management` \| `project_management` \| … | role playbooks |
| `vertical` | `pharma` \| `non_pharma` | role playbooks |
| `requires` | array | no — `{ playbook_id, status: completed }` |
| `competencies_granted` | string[] | no — granted on module complete |
| `missions` | array | yes |

## Mission / step

| Field | Type | Required |
| --- | --- | --- |
| `id` | string | yes |
| `title` | string | yes |
| `steps` | array | yes |

Step object:

| Field | Type | Required |
| --- | --- | --- |
| `id` | string | yes |
| `kind` | `read` \| `tool_task` \| `workspace_task` \| `agent_task` \| `quiz` \| `reflection` | yes |
| `title` | string | yes |
| `href` | string | no — deep link |
| `validation` | object | yes — `{ type: manual \| memory \| document \| run \| quiz, ... }` |
| `quiz` | object | if type quiz |
| `governance_anchor` | string | optional section id in governance page |
| `activity` | object | merged at load time from `content/{playbook_id}/{step_id}.json` |

## Activity content (`content/{playbook_id}/{step_id}.json`)

Merged onto each step as `activity` when the playbook is loaded. Used by `/tools/learning/activity/...` pages.

| Field | Type | Required |
| --- | --- | --- |
| `summary` | string | no — one-line learning outcome |
| `sections` | array | no — `{ heading?, paragraphs?, bullets? }[]` |
| `body` | string | no — plain fallback when no sections |
| `tool_cta` | object | no — `{ label, href, hint? }` secondary link to a platform tool |
| `reflection_prompt` | string | no — prompt for reflection steps |
| `governance_anchor` | string | no — link to `/governance#anchor` on fail or review |

If a content file is missing, the UI shows “Content pending” (no fallback to `href` alone).

## Brand overlay (`brands/*.json`)

| Field | Type |
| --- | --- |
| `brand_key` | string |
| `version` | integer |
| `append_missions` | mission[] |
| `step_patches` | `{ step_id, title?, body? }[]` |
