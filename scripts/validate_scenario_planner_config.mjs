#!/usr/bin/env node
/**
 * Validates config/scenario_planner JSON: steps align with dashboard phase catalog,
 * modifier registry matches tactics/*.json, deltas reference known step ids.
 *
 * Run from repo root: node scripts/validate_scenario_planner_config.mjs
 * Or: npm run validate:scenario-planner (from apps/web-dashboard)
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CFG = join(ROOT, 'config', 'scenario_planner');
const TACTICS_DIR = join(CFG, 'tactics');
const TIMING_PROFILES = join(CFG, 'timing_profiles.json');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

/** HappyGuy MLR JSON omits development_prb{1,2,3} rows (gap is computed in happyguy_strategy). */
const HAPPYGUY_SPINE_OMIT_IDS = new Set(['development_prb1', 'development_prb2', 'development_prb3']);

function canonicalHappyGuyMlrSpineRows(canonicalSteps) {
  return canonicalSteps.filter((row) => !HAPPYGUY_SPINE_OMIT_IDS.has(row.id));
}

/** HappyGuy MLR spines must mirror steps.json phase ids and labels (same order as catalog minus development_prb*). */
function assertHappyGuySpineMatchesCanonical(canonicalSteps, spineSteps, fileLabel) {
  const expected = canonicalHappyGuyMlrSpineRows(canonicalSteps);
  if (spineSteps.length !== expected.length) {
    fail(`${fileLabel}: expected ${expected.length} steps (steps.json minus development_prb*), got ${spineSteps.length}`);
  }
  for (let i = 0; i < expected.length; i++) {
    const a = expected[i];
    const b = spineSteps[i];
    if (b.id !== a.id) fail(`${fileLabel} steps[${i}]: id must be ${a.id}, got ${b.id}`);
    if (b.label !== a.label) fail(`${fileLabel} steps[${i}]: label must match steps.json for ${a.id}`);
  }
}

/** Validates `steps` array shape (ids unique, baseline_days ≥ 1). */
function validateStepsArray(steps, fileLabel) {
  if (!Array.isArray(steps)) fail(`${fileLabel}: steps must be an array`);
  const ids = new Set();
  for (let i = 0; i < steps.length; i++) {
    const row = steps[i];
    if (!row || typeof row !== 'object') fail(`${fileLabel} steps[${i}]: invalid row`);
    if (ids.has(row.id)) fail(`${fileLabel}: duplicate step id: ${row.id}`);
    ids.add(row.id);
    if (typeof row.label !== 'string' || !row.label.trim()) fail(`${fileLabel} steps[${i}]: label required`);
    if (typeof row.note !== 'string') fail(`${fileLabel} steps[${i}]: note required`);
    const bd = row.baseline_days;
    if (!Number.isInteger(bd) || bd < 1) fail(`${fileLabel} steps[${i}]: baseline_days must be integer >= 1`);
    if (row.min_days !== undefined && (!Number.isInteger(row.min_days) || row.min_days < 1)) {
      fail(`${fileLabel} steps[${i}]: min_days must be integer >= 1 if set`);
    }
    if (
      row.max_days !== undefined &&
      (!Number.isInteger(row.max_days) || row.max_days < (row.min_days ?? 1))
    ) {
      fail(`${fileLabel} steps[${i}]: max_days must be integer >= min_days if set`);
    }
  }
  return ids;
}

function main() {
  const stepsPath = join(CFG, 'steps.json');
  const regPath = join(CFG, 'modifiers.json');
  const data = readJson(stepsPath);
  if (data.version !== 1) fail(`steps.json: expected version 1, got ${data.version}`);
  const steps = data.steps;
  const ids = validateStepsArray(steps, 'steps.json');

  const rtePath = join(CFG, 'steps_skillarts_rte.json');
  let rteCount = 0;
  if (existsSync(rtePath)) {
    const rteData = readJson(rtePath);
    if (rteData.version !== 1) fail(`steps_skillarts_rte.json: expected version 1, got ${rteData.version}`);
    validateStepsArray(rteData.steps, 'steps_skillarts_rte.json');
    rteCount = rteData.steps.length;
  }

  const opdpPath = join(CFG, 'steps_opdp_happyguy.json');
  let opdpCount = 0;
  if (existsSync(opdpPath)) {
    const opdpData = readJson(opdpPath);
    if (opdpData.version !== 1) fail(`steps_opdp_happyguy.json: expected version 1, got ${opdpData.version}`);
    validateStepsArray(opdpData.steps, 'steps_opdp_happyguy.json');
    opdpCount = opdpData.steps.length;
  }

  const happyguyThursdayPath = join(CFG, 'steps_happyguy_mlr_thursday.json');
  const happyguyTuesdayPath = join(CFG, 'steps_happyguy_mlr_tuesday.json');
  let happyguySpineCount = 0;
  for (const [pth, label] of [
    [happyguyThursdayPath, 'steps_happyguy_mlr_thursday.json'],
    [happyguyTuesdayPath, 'steps_happyguy_mlr_tuesday.json'],
  ]) {
    if (!existsSync(pth)) fail(`${label}: missing`);
    const hg = readJson(pth);
    if (hg.version !== 1) fail(`${label}: expected version 1, got ${hg.version}`);
    validateStepsArray(hg.steps, label);
    assertHappyGuySpineMatchesCanonical(steps, hg.steps, label);
    happyguySpineCount += hg.steps.length;
  }

  const aasldPickupPath = join(CFG, 'steps_happyguy_aasld_congress_print_pickup.json');
  let aasldPickupCount = 0;
  if (existsSync(aasldPickupPath)) {
    const aasldData = readJson(aasldPickupPath);
    if (aasldData.version !== 1) {
      fail(`steps_happyguy_aasld_congress_print_pickup.json: expected version 1, got ${aasldData.version}`);
    }
    validateStepsArray(aasldData.steps, 'steps_happyguy_aasld_congress_print_pickup.json');
    if (aasldData.steps.length !== 35) {
      fail(
        `steps_happyguy_aasld_congress_print_pickup.json: expected 35 steps, got ${aasldData.steps.length}`,
      );
    }
    const first = aasldData.steps[0];
    const last = aasldData.steps[aasldData.steps.length - 1];
    if (first?.id !== 'aasld_pickup_discovery_update_timeline_egnyte') {
      fail('steps_happyguy_aasld_congress_print_pickup.json: first step id must be aasld_pickup_discovery_update_timeline_egnyte');
    }
    if (last?.id !== 'aasld_pickup_project_closeout') {
      fail('steps_happyguy_aasld_congress_print_pickup.json: last step id must be aasld_pickup_project_closeout');
    }
    aasldPickupCount = aasldData.steps.length;
  }

  const aasldWifiPath = join(CFG, 'steps_happyguy_aasld_congress_wifi_splash.json');
  let aasldWifiCount = 0;
  if (existsSync(aasldWifiPath)) {
    const wifiData = readJson(aasldWifiPath);
    if (wifiData.version !== 1) {
      fail(`steps_happyguy_aasld_congress_wifi_splash.json: expected version 1, got ${wifiData.version}`);
    }
    validateStepsArray(wifiData.steps, 'steps_happyguy_aasld_congress_wifi_splash.json');
    if (wifiData.steps.length !== 31) {
      fail(
        `steps_happyguy_aasld_congress_wifi_splash.json: expected 31 steps, got ${wifiData.steps.length}`,
      );
    }
    const wifiFirst = wifiData.steps[0];
    const wifiLast = wifiData.steps[wifiData.steps.length - 1];
    if (wifiFirst?.id !== 'aasld_wifi_discovery_update_timeline_egnyte') {
      fail('steps_happyguy_aasld_congress_wifi_splash.json: first step id must be aasld_wifi_discovery_update_timeline_egnyte');
    }
    if (wifiLast?.id !== 'aasld_wifi_project_closeout') {
      fail('steps_happyguy_aasld_congress_wifi_splash.json: last step id must be aasld_wifi_project_closeout');
    }
    aasldWifiCount = wifiData.steps.length;
  }

  const mpsWebsitePath = join(CFG, 'steps_happyguy_mps_website_update.json');
  let mpsWebsiteCount = 0;
  if (existsSync(mpsWebsitePath)) {
    const mpsData = readJson(mpsWebsitePath);
    if (mpsData.version !== 1) {
      fail(`steps_happyguy_mps_website_update.json: expected version 1, got ${mpsData.version}`);
    }
    validateStepsArray(mpsData.steps, 'steps_happyguy_mps_website_update.json');
    if (mpsData.steps.length !== 49) {
      fail(
        `steps_happyguy_mps_website_update.json: expected 49 steps, got ${mpsData.steps.length}`,
      );
    }
    const first = mpsData.steps[0];
    const last = mpsData.steps[mpsData.steps.length - 1];
    if (first?.id !== 'mps_web_site_markup') {
      fail('steps_happyguy_mps_website_update.json: first step id must be mps_web_site_markup');
    }
    if (last?.id !== 'mps_web_project_closeout') {
      fail('steps_happyguy_mps_website_update.json: last step id must be mps_web_project_closeout');
    }
    mpsWebsiteCount = mpsData.steps.length;
  }

  const brandedCrmEmailPath = join(CFG, 'steps_happyguy_branded_crm_email.json');
  let brandedCrmEmailCount = 0;
  if (existsSync(brandedCrmEmailPath)) {
    const crmData = readJson(brandedCrmEmailPath);
    if (crmData.version !== 1) {
      fail(`steps_happyguy_branded_crm_email.json: expected version 1, got ${crmData.version}`);
    }
    validateStepsArray(crmData.steps, 'steps_happyguy_branded_crm_email.json');
    if (crmData.steps.length !== 82) {
      fail(
        `steps_happyguy_branded_crm_email.json: expected 82 steps, got ${crmData.steps.length}`,
      );
    }
    const first = crmData.steps[0];
    const last = crmData.steps[crmData.steps.length - 1];
    if (first?.id !== 'crm_email_discovery_brief_timeline') {
      fail('steps_happyguy_branded_crm_email.json: first step id must be crm_email_discovery_brief_timeline');
    }
    if (last?.id !== 'crm_email_project_closeout') {
      fail('steps_happyguy_branded_crm_email.json: last step id must be crm_email_project_closeout');
    }
    brandedCrmEmailCount = crmData.steps.length;
  }

  const reg = readJson(regPath);
  const modList = reg.modifiers;
  if (!Array.isArray(modList)) fail('modifiers.json: modifiers must be an array');

  const tacticFiles = readdirSync(TACTICS_DIR).filter((f) => f.endsWith('.json'));
  const stems = new Set(tacticFiles.map((f) => f.replace(/\.json$/, '')));

  for (const m of modList) {
    if (!m || typeof m !== 'object') fail('modifiers.json: invalid entry');
    if (!m.id || typeof m.id !== 'string') fail('modifiers.json: each entry needs string id');
    if (!stems.has(m.id)) fail(`modifiers.json: missing tactics/${m.id}.json`);
  }

  for (const stem of stems) {
    const found = modList.some((m) => m.id === stem);
    if (!found) fail(`tactics/${stem}.json present but not listed in modifiers.json`);
  }

  const tpData = readJson(TIMING_PROFILES);
  if (tpData.version !== 1) fail(`timing_profiles.json: expected version 1, got ${tpData.version}`);
  const profiles = tpData.profiles;
  if (!Array.isArray(profiles)) fail('timing_profiles.json: profiles must be an array');
  const profileAllowedKeys = new Set([
    'id',
    'prb_cadence',
    'non_prb_multipliers',
    'client_family',
    'include_opdp_binder',
    'submit_anchor_weekday',
    'happyguy_spine',
  ]);
  const tpIds = new Set();
  for (let i = 0; i < profiles.length; i++) {
    const pr = profiles[i];
    if (!pr || typeof pr !== 'object') fail(`timing_profiles.profiles[${i}]: invalid`);
    for (const pk of Object.keys(pr)) {
      if (!profileAllowedKeys.has(pk)) fail(`timing_profiles.profiles[${i}]: unknown key: ${pk}`);
    }
    const pid = pr.id;
    if (!pid || typeof pid !== 'string') fail(`timing_profiles.profiles[${i}]: id required`);
    if (tpIds.has(pid)) fail(`timing_profiles: duplicate profile id: ${pid}`);
    tpIds.add(pid);
    if (pr.client_family !== undefined) {
      if (typeof pr.client_family !== 'string' || !pr.client_family.trim()) {
        fail(`timing_profiles.profiles[${i}]: client_family must be a non-empty string if set`);
      }
    }
    const cadence = pr.prb_cadence;
    if (
      cadence !== 'email_ml_r' &&
      cadence !== 'schematic_ml_r' &&
      cadence !== 'linear' &&
      cadence !== 'skillarts_tiered' &&
      cadence !== 'happyguy_week_aligned'
    ) {
      fail(
        `timing_profiles.profiles[${i}]: prb_cadence must be email_ml_r, schematic_ml_r, linear, skillarts_tiered, or happyguy_week_aligned`,
      );
    }
    if (pr.include_opdp_binder !== undefined && typeof pr.include_opdp_binder !== 'boolean') {
      fail(`timing_profiles.profiles[${i}]: include_opdp_binder must be boolean if set`);
    }
    if (pr.submit_anchor_weekday !== undefined) {
      if (pr.submit_anchor_weekday !== 'tuesday' && pr.submit_anchor_weekday !== 'thursday') {
        fail(`timing_profiles.profiles[${i}]: submit_anchor_weekday must be tuesday or thursday`);
      }
    }
    if (pr.happyguy_spine !== undefined) {
      if (cadence !== 'happyguy_week_aligned') {
        fail(`timing_profiles.profiles[${i}]: happyguy_spine is only valid when prb_cadence is happyguy_week_aligned`);
      }
      if (pr.happyguy_spine !== 'tuesday' && pr.happyguy_spine !== 'thursday') {
        fail(`timing_profiles.profiles[${i}]: happyguy_spine must be tuesday or thursday`);
      }
    }
    const mult = pr.non_prb_multipliers;
    if (!mult || typeof mult !== 'object' || Array.isArray(mult)) {
      fail(`timing_profiles.profiles[${i}]: non_prb_multipliers object required`);
    }
    for (const k of Object.keys(mult)) {
      if (!ids.has(k)) fail(`timing_profiles profile ${pid}: unknown step id in multipliers: ${k}`);
      const v = mult[k];
      if (typeof v !== 'number' || !Number.isFinite(v)) fail(`timing_profiles ${pid}.${k}: must be finite number`);
    }
  }
  const aliases = tpData.aliases;
  if (aliases !== undefined) {
    if (!aliases || typeof aliases !== 'object' || Array.isArray(aliases)) fail('timing_profiles.json: aliases must be an object');
    for (const [from, to] of Object.entries(aliases)) {
      if (!tpIds.has(to)) fail(`timing_profiles alias ${from} → ${to}: target profile missing`);
    }
  }

  for (const f of tacticFiles) {
    const p = join(TACTICS_DIR, f);
    const t = readJson(p);
    const stem = f.replace(/\.json$/, '');
    if (t.id !== stem) fail(`${f}: id must equal filename stem "${stem}"`);
    if (!t.label || typeof t.label !== 'string') fail(`${f}: label required`);
    const deltas = t.deltas;
    if (!deltas || typeof deltas !== 'object' || Array.isArray(deltas)) fail(`${f}: deltas object required`);
    for (const k of Object.keys(deltas)) {
      if (!ids.has(k)) fail(`${f}: unknown step id in deltas: ${k}`);
      const v = deltas[k];
      if (!Number.isInteger(v)) fail(`${f}: delta for ${k} must be integer`);
    }
    const pnotes = t.phase_notes;
    if (pnotes !== undefined) {
      if (!pnotes || typeof pnotes !== 'object' || Array.isArray(pnotes)) fail(`${f}: phase_notes must be an object if set`);
      for (const k of Object.keys(pnotes)) {
        if (!ids.has(k)) fail(`${f}: unknown step id in phase_notes: ${k}`);
        if (typeof pnotes[k] !== 'string') fail(`${f}: phase_notes.${k} must be a string`);
      }
    }
  }

  console.log(
    `scenario_planner config OK (${steps.length} default steps${rteCount ? `, ${rteCount} SkillArts RTE steps` : ''}${happyguySpineCount ? `, ${happyguySpineCount} HappyGuy MLR spine steps (2 files)` : ''}${aasldPickupCount ? `, ${aasldPickupCount} AASLD congress print pick-up steps` : ''}${aasldWifiCount ? `, ${aasldWifiCount} AASLD congress wifi splash steps` : ''}${mpsWebsiteCount ? `, ${mpsWebsiteCount} MPS website update steps` : ''}${brandedCrmEmailCount ? `, ${brandedCrmEmailCount} branded CRM email steps` : ''}${opdpCount ? `, ${opdpCount} OPDP binder steps` : ''}, ${modList.length} modifiers, ${tacticFiles.length} modifier bundle files, ${profiles.length} timing profiles).`,
  );
}

main();
