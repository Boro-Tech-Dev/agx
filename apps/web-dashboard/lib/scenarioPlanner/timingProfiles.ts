import rawTimingProfiles from '../../config/scenario_planner/timing_profiles.json';

export type PrbCadence =
  | 'email_ml_r'
  | 'schematic_ml_r'
  | 'linear'
  | 'skillarts_tiered'
  | 'happyguy_week_aligned';

export type TimingProfileDef = {
  id: string;
  prb_cadence: PrbCadence;
  non_prb_multipliers: Record<string, number>;
  /** Optional tag for display / filtering (e.g. schematic MLR family). */
  client_family?: string;
  /** HappyGuy week-aligned PRB submit anchor. */
  submit_anchor_weekday?: 'tuesday' | 'thursday';
  /**
   * When `prb_cadence` is `happyguy_week_aligned`, which default MLR spine JSON to load
   * (`steps_happyguy_mlr_thursday.json` vs `tuesday`). If omitted, uses `submit_anchor_weekday`
   * (default Thursday when that is also unset).
   */
  happyguy_spine?: 'tuesday' | 'thursday';
  /** When true, compute parallel OPDP binder steps from PRB3 review anchor. */
  include_opdp_binder?: boolean;
};

type TimingProfilesFile = {
  version: number;
  profiles: TimingProfileDef[];
  aliases?: Record<string, string>;
};

const file = rawTimingProfiles as TimingProfilesFile;

const _byId = new Map<string, TimingProfileDef>();
for (const p of file.profiles) {
  _byId.set(p.id, p);
}

const _aliases: Record<string, string> = { ...(file.aliases ?? {}) };

/** Stable ordered ids from config (includes legacy asset ids and extended profiles). */
export const TIMING_PROFILE_IDS = file.profiles.map((p) => p.id) as readonly string[];

export function resolveTimingProfileId(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  return _aliases[s] ?? s;
}

export function getTimingProfile(id: string): TimingProfileDef | undefined {
  return _byId.get(resolveTimingProfileId(id));
}

export function isKnownTimingProfile(id: string): boolean {
  return _byId.has(resolveTimingProfileId(id));
}

export function timingProfileMultForPhase(profileId: string, phaseId: string): number {
  const p = getTimingProfile(profileId);
  if (!p) return 1;
  const v = p.non_prb_multipliers[phaseId];
  return typeof v === 'number' && Number.isFinite(v) ? v : 1;
}

/** True when the profile uses schematic / generic HCP MLR PRB rules (Monday submit + anchored Wednesday review). */
export function usesSchematicMlrPrbCadence(profileId: string): boolean {
  const p = getTimingProfile(profileId);
  const c = p?.prb_cadence;
  return c === 'email_ml_r' || c === 'schematic_ml_r';
}

/**
 * @deprecated Use {@link usesSchematicMlrPrbCadence}. The JSON value `email_ml_r` is a legacy cadence id for the same
 * schematic generic MLR behavior (`schematic_strategy` / `schematic_strategy.py`).
 */
export function usesEmailMlrPrbCadence(profileId: string): boolean {
  return usesSchematicMlrPrbCadence(profileId);
}

export function usesSkillArtsTieredPrbCadence(profileId: string): boolean {
  const p = getTimingProfile(profileId);
  return p?.prb_cadence === 'skillarts_tiered';
}

export function usesHappyGuyWeekAlignedPrbCadence(profileId: string): boolean {
  const p = getTimingProfile(profileId);
  return p?.prb_cadence === 'happyguy_week_aligned';
}

export function timingProfileIncludesOpdpBinder(profileId: string): boolean {
  const p = getTimingProfile(profileId);
  return p?.include_opdp_binder === true;
}

/**
 * @deprecated The planner no longer uses `submit_anchor_weekday` to place HappyGuy PRB dates
 * (submit uses Tuesday/Thursday **proximity**; both `happyguy_submit_*` ids share one engine).
 * This reads the profile field for legacy display or callers only.
 */
export function happyGuySubmitAnchorWeekday(profileId: string): 'tuesday' | 'thursday' {
  const p = getTimingProfile(resolveTimingProfileId(profileId));
  return p?.submit_anchor_weekday === 'tuesday' ? 'tuesday' : 'thursday';
}

/** Which HappyGuy MLR baseline spine file to use for this profile (Thursday vs Tuesday milestone notes). */
export function happyGuyMlrSpineWeekday(profileId: string): 'tuesday' | 'thursday' {
  const p = getTimingProfile(resolveTimingProfileId(profileId));
  if (!p || p.prb_cadence !== 'happyguy_week_aligned') return 'thursday';
  if (p.happyguy_spine === 'tuesday' || p.happyguy_spine === 'thursday') return p.happyguy_spine;
  return p.submit_anchor_weekday === 'tuesday' ? 'tuesday' : 'thursday';
}

/** Human-readable label for timing profile ids (fallback: snake_case → Title Case). */
export function timingProfileLabel(id: string): string {
  const labels: Record<string, string> = {
    generic_tactic: 'Generic tactic (Schematic MLR / HCP cadence)',
    skillarts_generic: 'SkillArts (tiered Thursday PRB)',
    happyguy_submit_thursday: 'HappyGuy (Tue/Thu PRB via proximity; legacy id)',
    happyguy_submit_tuesday: 'HappyGuy (Tue/Thu PRB via proximity; legacy id)',
    happyguy_mad_healthgrades_360_email: 'HappyGuy — Wellscore 360 email (vendor + OPDP cadence)',
    happyguy_mad_patient_profiles_tll: 'HappyGuy — Unbranded patient profiles / TLL cadence',
    happyguy_mad_liver_brochure_training_blueprint: 'HappyGuy — Liver brochure / training schematic cadence',
    generic_tactic_linear: 'Generic tactic (linear PRB)',
    website: 'Website / landing',
    banner: 'Banner / standard display',
    clm: 'CLM',
    brochure_4pg: 'Brochure ~4 pp',
    brochure_12pg: 'Brochure ~12 pp',
    brochure_24pg: 'Brochure ~24 pp',
    tradeshow_digital: 'Tradeshow digital',
    tradeshow_panel: 'Tradeshow panel',
    video_production: 'Video production',
    animation: 'Animation',
    display_standard: 'Display / programmatic',
    social_paid: 'Paid social',
    sem_seo: 'SEM / SEO',
    ctv_streaming: 'CTV / streaming',
    retail_media: 'Retail media',
    endemic_publisher: 'Endemic publisher digital',
    sms_push: 'SMS / push',
    influencer_creator: 'Influencer / creator',
    audio_podcast_streaming: 'Digital audio / podcast',
    webinar_virtual_event: 'Webinar / virtual event',
    mobile_app_web: 'Mobile app / web experience',
    dooh_digital: 'Digital OOH',
    print_magazine_newspaper: 'Print magazine / newspaper',
    print_insert_fsi: 'Print insert / FSI',
    direct_mail: 'Direct mail',
    ooh_static: 'Static OOH',
    poc_print: 'Point of care print',
    congress_exhibit_print: 'Congress / exhibit print',
    collateral_leave_behind: 'Collateral / leave-behind',
  };
  if (labels[id]) return labels[id];
  return id
    .split('_')
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Workspace / client keys used to infer default timing profile and scenario cadence lists. */
export type ProjectHierarchyKeys = {
  workspace_key?: string | null;
  client_key?: string | null;
  brand_key?: string | null;
};

function normPlannerKey(s: string | null | undefined): string {
  return String(s ?? '').trim();
}

/** Client cadence bucket for scenario planner filtering (not necessarily identical to default profile id). */
export type PlannerClientFamily = 'happyguy' | 'skillarts' | 'schematic';

/**
 * Maps resolved timing profile (or explicit profile id) to a planner client family for cadence dropdown filtering.
 */
export function inferClientFamilyForPlanner(
  row: ProjectHierarchyKeys | null | undefined,
  resolvedProfileId?: string | null,
): PlannerClientFamily | null {
  const profileId = resolvedProfileId?.trim()
    ? resolveTimingProfileId(resolvedProfileId.trim())
    : null;
  if (profileId) {
    const fam = getTimingProfile(profileId)?.client_family;
    if (fam === 'happyguy' || fam === 'skillarts' || fam === 'schematic') return fam;
    const cadence = getTimingProfile(profileId)?.prb_cadence;
    if (cadence === 'skillarts_tiered') return 'skillarts';
    if (cadence === 'email_ml_r' || cadence === 'schematic_ml_r') return 'schematic';
    if (cadence === 'happyguy_week_aligned') return 'happyguy';
  }
  return null;
}

/**
 * Ordered timing profile ids for the scenario planner cadence dropdown: all profiles for the inferred
 * client family, or the full catalog when family is unknown (pre-project / generic workspace).
 */
export function timingProfileIdsForScenarioPlanner(
  row: ProjectHierarchyKeys | null | undefined,
  resolvedProfileId?: string | null,
): string[] {
  const fam = inferClientFamilyForPlanner(row, resolvedProfileId);
  if (fam === 'happyguy') {
    return TIMING_PROFILE_IDS.filter((id) => getTimingProfile(id)?.client_family === 'happyguy');
  }
  if (fam === 'skillarts') {
    return TIMING_PROFILE_IDS.filter((id) => getTimingProfile(id)?.prb_cadence === 'skillarts_tiered');
  }
  if (fam === 'schematic') {
    const withFamily = TIMING_PROFILE_IDS.filter((id) => getTimingProfile(id)?.client_family === 'schematic');
    const out = [...withFamily];
    for (const id of ['generic_tactic_linear'] as const) {
      if (TIMING_PROFILE_IDS.includes(id) && !out.includes(id)) out.push(id);
    }
    return out;
  }
  return [...TIMING_PROFILE_IDS];
}
