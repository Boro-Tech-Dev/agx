# Scenario planner config schema

Versioned JSON under this directory is the source of truth for **linear** delivery planning (kickoff anchor, sequential phases, business-day calendar).

## `steps.json`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `version` | integer | yes | Schema version; currently `1`. |
| `steps` | array | yes | Ordered list of phases; order must match [`phaseCatalog.ts`](../../apps/web-dashboard/lib/scenarioPlanner/phaseCatalog.ts) / `timeline_phase_catalog.py`. |

Each step object:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes | Stable id (`phase_id`); must match catalog. |
| `label` | string | yes | Display label; must match catalog. |
| `baseline_days` | integer | yes | Default duration in **business days** (≥ 1). |
| `min_days` | integer | no | Floor after modifiers (default 1). |
| `max_days` | integer | no | Optional ceiling after modifiers. |
| `note` | string | yes | Shown in timeline / CSV note column. |

## `steps_skillarts_rte.json` (optional spine)

Used **only** when the timing profile is `skillarts_generic` (SkillArts IV RTE export). Same step object shape as above; `id` values are typically `skillarts_rte_*` plus injected MLR anchor phases (`submit_prb1`, `prb1_review`, …). Order does **not** mirror `phaseCatalog.ts`; it follows the exported RTE task list with a PRB1/FUSE anchor block inserted before the first **FUSE Review** row.

## `steps_happyguy_mlr_thursday.json` / `steps_happyguy_mlr_tuesday.json`

Default **HappyGuy MLR** configurable timelines: **same** ordered `id` and `label` as [`steps.json`](steps.json) / [`phaseCatalog.ts`](../../apps/web-dashboard/lib/scenarioPlanner/phaseCatalog.ts) **excluding** `development_prb1`, `development_prb2`, `development_prb3` (those gaps are computed in `happyguy_strategy`). Only `baseline_days`, optional min/max, and `note` differ.

| Condition | Spine file |
| --- | --- |
| Any profile with `prb_cadence` = `happyguy_week_aligned` and `happyguy_spine` = `thursday`, or weekday omitted / `submit_anchor_weekday` = `thursday` | `steps_happyguy_mlr_thursday.json` |
| Same with `happyguy_spine` = `tuesday`, or `submit_anchor_weekday` = `tuesday` (when `happyguy_spine` omitted) | `steps_happyguy_mlr_tuesday.json` |

Legacy ids `happyguy_submit_thursday` / `happyguy_submit_tuesday` remain; additional HappyGuy profiles use the same engine and pick the spine via `happyguy_spine` or `submit_anchor_weekday`.

Milestone language for Submit Thursday vs Submit Tuesday is baked into spine `note` fields on `route_to_clean`, `share_client_approval_prb1`, `complete_fact_check`, and `client_review_3_submission_prep`. Legacy modifier bundles `happyguy_milestones_*` remain no-op placeholders for older presets.

## Timing profiles (`timing_profiles.json`)

Defines **scheduling profiles** used by the linear scenario engine (dashboard + worker). Each profile has:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes | Stable profile id (referenced from tactic library `metadata.timing_profile` and omnichannel rows). |
| `prb_cadence` | string | yes | **Schematic / generic HCP MLR:** `email_ml_r` (legacy id) or `schematic_ml_r` (same Monday submit + second working Wednesday review for PRB phases; engine: `schematic_strategy`). **`linear`** — sequential business-day PRB spans. **`skillarts_tiered`** — Thursday submit anchor + page-tier working days from submit start to review start, inclusive. **`happyguy_week_aligned`** — Tuesday or Thursday submit anchor; PRB review on the **same weekday** as submit, on the first **working** occurrence **on or after** submit start **+7 calendar days** (forward across holidays, never the previous calendar day). |
| `non_prb_multipliers` | object | yes | Map of `step_id` → positive factor vs baseline for **non-PRB** phases only. Omitted keys imply `1`. |
| `client_family` | string | no | Optional tag for filtering or display (e.g. `schematic` on the default HCP MLR profile). Ignored by the planner except for tooling. |
| `submit_anchor_weekday` | string | no | **Deprecated for scheduling.** HappyGuy PRB submit weekday is chosen by **proximity** (Tuesday vs Thursday) from the **calendar day after** the prior spine row end (for PRB submits, `share_client_approval_prb{n}` ends immediately before `submit_prb{n}` in the HappyGuy spine—not from kickoff). Both legacy profile ids `happyguy_submit_thursday` and `happyguy_submit_tuesday` use the same engine. The field may remain for documentation or filters only. When `happyguy_spine` is omitted on a `happyguy_week_aligned` profile, this field also selects which HappyGuy MLR JSON (`*_thursday` vs `*_tuesday`) is loaded for baseline days and milestone `note` text. |
| `happyguy_spine` | string | no | Only when `prb_cadence` = `happyguy_week_aligned`. Explicitly `thursday` or `tuesday`: selects `steps_happyguy_mlr_thursday.json` vs `steps_happyguy_mlr_tuesday.json`. Overrides `submit_anchor_weekday` for spine choice when both are set. |
| `include_opdp_binder` | boolean | no | When true, response may include `opdp_binder_steps`: parallel OPDP binder track anchored to the **last PRB review** row present for the chosen complexity (basic/medium/complex). |

### HappyGuy MAD-derived profiles

Calibrated from agency MAD timelines; same `happyguy_week_aligned` PRB engine as `happyguy_submit_*`. Tactic library keys in `config/tactic_library/catalog.json` mirror these ids.

| Profile id | Theme | Binder |
| --- | --- | --- |
| `happyguy_mad_healthgrades_360_email` | Vendor screenshot / resubmit-heavy email + late deployment | yes |
| `happyguy_mad_patient_profiles_tll` | TLL / patient-profile creative + long post-PRB1 revision track | no |
| `happyguy_mad_liver_brochure_training_blueprint` | Shorter upfront; accessibility + fact-check overlap on layout | no |

Task clusters from exports are mapped onto canonical `phase_id`s via `non_prb_multipliers` (see `timing_profiles.json`).

## `steps_opdp_happyguy.json`

Separate mini-spine for **parallel** OPDP binder phases (22 business days total). Not part of the default `steps.json` catalog; loaded only when computing `opdp_binder_steps` for profiles with `include_opdp_binder: true`.

Optional root-level `aliases`: map of alternate string → canonical profile `id`.

**SkillArts tiered cadence** (`skillarts_generic`): request `pageCount` on scenario compute (integer pages ≥ 1). Tiers use **inclusive working days** from PRB submit start to PRB review start: `page_count >= 30` → 10; `15 <= page_count <= 29` → 5; `page_count < 15` → 3. When `pageCount` is omitted, the engine defaults to **20** pages (mid tier).

This file is distinct from the **advertising tactic library** (Postgres `tactics` table): many library tactics can share one timing profile.

## Modifier bundles (`tactics/*.json`)

The `tactics/` subdirectory holds **stackable modifier bundles** only (additive business-day deltas), not the tactic library. Each file defines one modifier bundle. Multiple modifiers can be active; **stacking order** is the order of `activeModifierIds` in the API / UI, after which **per-step deltas are summed** (Option A from the architecture doc).

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | yes | Must equal filename stem and registry entry. |
| `label` | string | yes | Short UI label. |
| `description` | string | no | Longer help text for the dashboard. |
| `deltas` | object | yes | Map of `step_id` → integer delta (business days added; negative allowed). Keys must exist in `steps.json`. Omitted steps imply 0. |

**Effective duration** per step:

```text
scaled = round(baseline_days × complexity_mult × tactic_mult)   # non-PRB only; PRB uses baseline_days
effective = clamp(scaled + sum(delta_i), min_days, max_days)
```

- `complexity_mult`: basic `0.85`, medium `1`, complex `1.25` (non-PRB only).
- **PRB rounds**: basic includes **one** PRB round (PRB1 only), medium **two** (PRB1 + PRB2), complex **three** (PRB1–PRB3). Steps for omitted rounds are not scheduled.
- `tactic_mult`: from the selected timing profile’s `non_prb_multipliers` in `timing_profiles.json` (e.g. profile `generic_tactic` uses factors `1` everywhere by default).
- PRB phase ids (`submit_prb1`, `prb1_review`, `submit_prb2`, `prb2_review`): no tactic/complexity scaling; only `baseline_days`, min/max, modifiers, and optional client-review extras where applicable.

**Client review extra** (API `clientReviewExtraCalendarDays`): adds that many **business days** to each phase in `CLIENT_REVIEW_SCENARIO_PHASE_IDS` after the formula above (name retained for backward compatibility).

## `modifiers.json`

Registry of modifier ids available in the UI (each must have a matching `tactics/<id>.json`).

## `holidays/*.json`

Optional reference lists of US federal (or other) holidays as ISO `YYYY-MM-DD` arrays for documentation and tests. Runtime scheduling uses holidays passed from the dashboard API (`useHolidays`) merged with weekends via `workingDays.ts`.

## Validation

Run `npm run validate:scenario-planner` from `apps/web-dashboard`.

## Adding a modifier

1. Add `tactics/<id>.json` and list `id` in `modifiers.json`.
2. Register the bundle for the dashboard bundle: import it in [`modifierBundles.ts`](../../apps/web-dashboard/lib/scenarioPlanner/linear/modifierBundles.ts) and add to `REGISTERED_MODIFIER_BUNDLES`.
3. Register the filename in [`linear_scenario.py`](../../apps/agent-worker/worker/scenario_engine/linear_scenario.py) `_MODIFIER_FILENAMES` so the worker loads the same JSON.
4. Run `npm run validate:scenario-planner`.
