'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';

import { useHolidays } from '../../hooks/useHolidays';
import { useLocalTodayIso } from '../../hooks/useLocalTodayIso';
import { PanelChevron } from '../workspaces/PanelChevron';
import TimelineKeyDatesView from '../workspaces/panels/TimelineKeyDatesView';
import { ScenarioEditableStepsTable } from './ScenarioEditableStepsTable';
import {
  listTacticsLibrary,
  postComputeScenarioSteps,
  postFindLatestKickoffForDeadline,
  uploadProjectDocument,
} from '../../lib/api';
import { filterLibraryRowsForAttach } from '../../lib/tacticLibraryFilter';
import {
  buildScenarioPayloadFromSteps,
  computeTimelinePreview,
  halTimelineStepsEqual,
  halTimelineStepsToCsv,
  parseHalTimelineCsv,
  validateHalTimelineSteps,
  type HalTimelineScenarioPayload,
  type HalTimelineStep,
} from '../../lib/halScenario';
import type { TimelineKeyDatesRow } from '../../lib/timelineKeyDatesModel';
import {
  SCENARIO_COMPLEXITIES,
  scenarioComplexityLabel,
  type ScenarioComplexity,
} from '../../lib/scenarioPlanner/complexity';
import { addCalendarDaysUTC } from '../../lib/scenarioPlanner/dateCalendar';
import { KICKOFF_DEADLINE_SEARCH_WINDOW_DAYS } from '../../lib/scenarioPlanner/findLatestKickoffForDeadline';
import type { LinearStepBreakdown } from '../../lib/scenarioPlanner/linear/types';
import {
  BASIC_KEY_DATE_MAX_CONSECUTIVE_WD,
  enrichComplexScenarioKeyDateRows,
} from '../../lib/scenarioPlanner/scenarioKeyDateCalendar';
import { PHASE_CATALOG } from '../../lib/scenarioPlanner/phaseCatalog';
import { getScenarioStepsOrdered, MODIFIERS_REGISTRY } from '../../lib/scenarioPlanner/linear/loadPlannerConfig';
import { resolveTimingProfileFromTacticLibraryRow } from '../../lib/scenarioPlanner/resolveTimingProfileFromTacticRow';
import {
  inferClientFamilyForPlanner,
  timingProfileIdsForScenarioPlanner,
  type ProjectHierarchyKeys,
} from '../../lib/scenarioPlanner/timingProfiles';
import { inferTimingProfileFromProject } from '../../lib/tools/inferTimingProfileFromProject';
import {
  canonicalPageCountForSkillArtsTier,
  DEFAULT_SKILLARTS_PAGE_COUNT,
  SKILL_ARTS_TIER_IDS,
  SKILL_ARTS_TIER_LABEL,
  skillArtsTierFromPageCount,
  type SkillArtsTierId,
} from '../../lib/scenarioPlanner/skillArtsTier';
import { SCENARIO_TACTICS, scenarioTacticLabel, type ScenarioTactic } from '../../lib/scenarioPlanner/tactics';
import { usesSkillArtsTieredPrbCadence } from '../../lib/scenarioPlanner/timingProfiles';
import { shiftStepToStartDate } from '../../lib/scenarioPlanner/scenarioStepShift';

const SCHEDULE_INTRO =
  'Forward mode: linear plan from kickoff. Needed-by mode: latest kickoff such that the chosen milestone phase ends on or before your date. Schedule math runs on the scenario planner worker (Queue & workers → Scenario planner worker). When this project’s workspace/client is recognized (HappyGuy, SkillArts, Schematic), pick a **cadence / timeline** from the client-scoped list (from repo `timing_profiles.json`); that choice drives the schedule. An optional **tactic library** row is for marketing alignment or attach flows only and does not override cadence for those clients. If the library is empty and the client is unknown, choose any timing profile from the full list. Phases use business days (weekends excluded) plus optional US federal holidays when loaded; baselines live in repo config; complexity scales non-PRB phases; modifiers stack. Schematic HCP MLR profiles pin PRB submits/reviews to Monday / second working Wednesday; SkillArts tiered profiles use Thursday submit anchors and page-based submit→review spans; linear profiles advance PRB steps sequentially. Toggle “calendar days” per phase only when that phase may span weekends.';

function stepsToKeyDateRows(
  steps: { task: string; start_date: string; end_date: string; note?: string }[],
  breakdown: LinearStepBreakdown[] | null,
): TimelineKeyDatesRow[] {
  if (!steps.length) return [];
  if (!breakdown || breakdown.length !== steps.length) {
    return steps.map((s, i) => ({
      id: `scenario-import-${i}-${s.task.slice(0, 24)}`,
      title: s.task,
      start_date_iso: s.start_date,
      end_date_iso: s.end_date,
      phase_id: null,
      phase_order: i + 1,
      raw_label: s.task,
      timeline_note: s.note,
      scenario_step_index: i,
    }));
  }
  return breakdown.map((b, i) => {
    const s = steps[i]!;
    const cat = PHASE_CATALOG.find((r) => r.phase_id === b.phase_id);
    const order = cat?.order ?? i + 1;
    return {
      id: `${b.phase_id}-${order}`,
      title: s.task,
      start_date_iso: s.start_date,
      end_date_iso: s.end_date,
      phase_id: b.phase_id,
      phase_order: order,
      raw_label: s.task,
      timeline_note: s.note,
      scenario_step_index: i,
    };
  });
}

function holidayRangeForKickoff(anchorIso: string): { from: string; to: string } {
  const y = Number(anchorIso.slice(0, 4));
  if (!Number.isFinite(y)) return { from: '2026-01-01', to: '2028-12-31' };
  return { from: `${y - 1}-01-01`, to: `${y + 2}-12-31` };
}

/** Widen holiday fetch when the schedule may span many calendar days (e.g. reverse planner window). */
function holidayRangeSpanning(earlyIso: string, lateIso: string): { from: string; to: string } {
  const y1 = Number(earlyIso.slice(0, 4));
  const y2 = Number(lateIso.slice(0, 4));
  const yMin = Math.min(y1, y2);
  const yMax = Math.max(y1, y2);
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) return { from: '2026-01-01', to: '2028-12-31' };
  return { from: `${yMin - 1}-01-01`, to: `${yMax + 2}-12-31` };
}

function formatModifierDeltas(d: Record<string, number>): string {
  const entries = Object.entries(d);
  if (entries.length === 0) return '—';
  return entries.map(([k, v]) => `${k}: ${v >= 0 ? '+' : ''}${v}`).join('; ');
}

function prbCadenceSummary(steps: HalTimelineStep[], breakdown: LinearStepBreakdown[] | null): string {
  const startFor = (phaseId: string) => {
    if (!breakdown) return undefined;
    const i = breakdown.findIndex((b) => b.phase_id === phaseId);
    if (i < 0 || i >= steps.length) return undefined;
    return steps[i]!.start_date;
  };
  const parts: string[] = [];
  const s1s = startFor('submit_prb1');
  const s1r = startFor('prb1_review');
  const s2s = startFor('submit_prb2');
  const s2r = startFor('prb2_review');
  const s3s = startFor('submit_prb3');
  const s3r = startFor('prb3_review');
  if (s1s) parts.push(`PRB1 submit ${s1s}`);
  if (s1r) parts.push(`PRB1 review ${s1r}`);
  if (s2s) parts.push(`PRB2 submit ${s2s}`);
  if (s2r) parts.push(`PRB2 review ${s2r}`);
  if (s3s) parts.push(`PRB3 submit ${s3s}`);
  if (s3r) parts.push(`PRB3 review ${s3r}`);
  return parts.join(' · ');
}

const LS_OPTIONS = 'dd.scenarioPlanner.optionsExpanded';
const LS_OPTIONS_LEGACY = 'dd.halScenario.optionsExpanded';
const LS_MODIFIERS = 'dd.scenarioPlanner.modifiersExpanded';
const LS_BREAKDOWN = 'dd.scenarioPlanner.breakdownExpanded';

function readLsBool(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  const v = localStorage.getItem(key) ?? (fallback ? '1' : '0');
  return v === '1' || v === 'true';
}

function writeLsBool(key: string, value: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, value ? '1' : '0');
}

type ScenarioPlanningMode = 'kickoff' | 'needed_by';

function cadenceSourceLabel(source: 'brand' | 'project' | 'session' | 'none'): string {
  switch (source) {
    case 'brand':
      return 'Brand default';
    case 'project':
      return 'Project override';
    case 'session':
      return 'Session override';
    default:
      return 'No default — using fallback';
  }
}

function CadenceSourceBadge({
  source,
  timingProfileEffective,
  brandTimingProfileId,
  projectTimingProfileId,
  brandId,
  projectKey,
  onSaveCadenceAsBrandDefault,
  onSaveCadenceAsProjectDefault,
}: {
  source: 'brand' | 'project' | 'session' | 'none';
  timingProfileEffective: ScenarioTactic;
  brandTimingProfileId: ScenarioTactic | null;
  projectTimingProfileId: ScenarioTactic | null;
  brandId: string | null;
  projectKey: string;
  onSaveCadenceAsBrandDefault?: (profileId: ScenarioTactic) => Promise<void>;
  onSaveCadenceAsProjectDefault?: (profileId: ScenarioTactic) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const showSaveBrand =
    Boolean(brandId && onSaveCadenceAsBrandDefault) &&
    timingProfileEffective !== brandTimingProfileId;
  const showSaveProject =
    Boolean(projectKey.trim() && onSaveCadenceAsProjectDefault) &&
    timingProfileEffective !== (projectTimingProfileId ?? brandTimingProfileId);

  return (
    <div className="mt-1.5 space-y-1">
      <p className="text-[9px] text-app-muted">
        <span className="font-medium text-app-text">{cadenceSourceLabel(source)}</span>
        {' · '}
        <span className="font-mono">{timingProfileEffective}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {showSaveBrand ? (
          <button
            type="button"
            disabled={saving}
            className="rounded border border-app-border bg-app-surface px-2 py-0.5 text-[9px] font-semibold text-app-text hover:bg-app-fill-hover disabled:opacity-50"
            onClick={() => {
              setSaving(true);
              void onSaveCadenceAsBrandDefault!(timingProfileEffective).finally(() => setSaving(false));
            }}
          >
            Save as default for this brand
          </button>
        ) : null}
        {showSaveProject ? (
          <button
            type="button"
            disabled={saving}
            className="rounded border border-app-border bg-app-surface px-2 py-0.5 text-[9px] font-semibold text-app-text hover:bg-app-fill-hover disabled:opacity-50"
            onClick={() => {
              setSaving(true);
              void onSaveCadenceAsProjectDefault!(timingProfileEffective).finally(() => setSaving(false));
            }}
          >
            Save as default for this project
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ScenarioPanel({
  enabled,
  onScenarioChange,
  projectKey = '',
  onScenarioProjectSave,
  onScenarioProjectSaveError,
  scenarioTactic: scenarioTacticProp,
  onScenarioTacticChange,
  projectCadenceContext = null,
  brandId = null,
  cadenceSource = 'none',
  brandTimingProfileId = null,
  projectTimingProfileId = null,
  onSaveCadenceAsBrandDefault,
  onSaveCadenceAsProjectDefault,
}: {
  enabled: boolean;
  onScenarioChange: (payload: HalTimelineScenarioPayload | null) => void;
  /** When set, user can upload the computed scenario as project file kind `scenario` (not timeline). */
  projectKey?: string;
  onScenarioProjectSave?: (message: string) => void;
  onScenarioProjectSaveError?: (message: string) => void;
  /** When set, timing profile is controlled by the parent (e.g. Tools Omnichannel Planner). */
  scenarioTactic?: ScenarioTactic | null;
  brandId?: string | null;
  cadenceSource?: 'brand' | 'project' | 'session' | 'none';
  brandTimingProfileId?: ScenarioTactic | null;
  projectTimingProfileId?: ScenarioTactic | null;
  onSaveCadenceAsBrandDefault?: (profileId: ScenarioTactic) => Promise<void>;
  onSaveCadenceAsProjectDefault?: (profileId: ScenarioTactic) => Promise<void>;
  onScenarioTacticChange?: (tactic: ScenarioTactic) => void;
  /** Current project workspace/client so tactic library rows resolve to the correct client cadence. */
  projectCadenceContext?: ProjectHierarchyKeys | null;
}) {
  const scenarioControlled = scenarioTacticProp !== undefined;
  const [libraryTactics, setLibraryTactics] = useState<Record<string, unknown>[]>([]);
  const [libraryErr, setLibraryErr] = useState<string | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [selectedLibraryTacticId, setSelectedLibraryTacticId] = useState<string>('');
  const [fallbackTimingProfile, setFallbackTimingProfile] = useState<ScenarioTactic>('generic_tactic');
  const onScenarioTacticChangeRef = useRef(onScenarioTacticChange);
  onScenarioTacticChangeRef.current = onScenarioTacticChange;

  const profileHintForFamily = scenarioTacticProp ?? null;
  const hasPlannerClientFamily =
    inferClientFamilyForPlanner(projectCadenceContext, profileHintForFamily) !== null;
  const cadenceOptionIds = useMemo(
    () => timingProfileIdsForScenarioPlanner(projectCadenceContext, profileHintForFamily),
    [projectCadenceContext, profileHintForFamily],
  );

  const selectedLibraryRow = useMemo(
    () => libraryTactics.find((x) => String(x.id) === selectedLibraryTacticId),
    [libraryTactics, selectedLibraryTacticId],
  );
  const catalogTacticKey = useMemo(() => {
    const k = selectedLibraryRow?.key;
    return typeof k === 'string' && k.trim() ? k.trim() : undefined;
  }, [selectedLibraryRow]);
  const groupedLibrary = useMemo(() => {
    const m = new Map<string, Record<string, unknown>[]>();
    for (const t of libraryTactics) {
      const ch = typeof t.channel === 'string' && t.channel.trim() ? String(t.channel) : 'Other';
      if (!m.has(ch)) m.set(ch, []);
      m.get(ch)!.push(t);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [libraryTactics]);

  /** When true, cadence comes from the explicit client-scoped timing profile select, not from tactic library resolution. */
  const useClientCadencePicker = !scenarioControlled && hasPlannerClientFamily;

  /** Tools (and similar): parent passes `scenarioTactic` but we still show client-scoped cadence when workspace/client maps. */
  const mappedClientCadenceInControlledMode = scenarioControlled && hasPlannerClientFamily;

  const showCadenceTimelineRow =
    useClientCadencePicker ||
    libraryTactics.length === 0 ||
    mappedClientCadenceInControlledMode ||
    (scenarioControlled && scenarioTacticProp == null);

  const cadenceRowOptionIds = useMemo((): readonly string[] => {
    if (
      hasPlannerClientFamily &&
      (useClientCadencePicker || scenarioControlled || libraryTactics.length === 0)
    ) {
      return cadenceOptionIds;
    }
    return SCENARIO_TACTICS;
  }, [
    hasPlannerClientFamily,
    useClientCadencePicker,
    scenarioControlled,
    libraryTactics.length,
    cadenceOptionIds,
  ]);

  const cadenceSelectValue: ScenarioTactic = useMemo(() => {
    if (mappedClientCadenceInControlledMode) {
      const p = scenarioTacticProp ?? cadenceRowOptionIds[0];
      if (p == null) return fallbackTimingProfile;
      return (cadenceRowOptionIds.includes(p) ? p : (cadenceRowOptionIds[0] as ScenarioTactic)) ?? p;
    }
    return fallbackTimingProfile;
  }, [
    mappedClientCadenceInControlledMode,
    scenarioTacticProp,
    cadenceRowOptionIds,
    fallbackTimingProfile,
  ]);

  const timingProfileResolvedLibrary = useMemo(() => {
    if (scenarioControlled || libraryTactics.length === 0 || useClientCadencePicker) return null;
    return resolveTimingProfileFromTacticLibraryRow(selectedLibraryRow ?? null, projectCadenceContext ?? null);
  }, [scenarioControlled, libraryTactics.length, selectedLibraryRow, projectCadenceContext, useClientCadencePicker]);

  /** Selected tactic exists but metadata + catalog + project inference did not yield a timing profile. */
  const libraryCadenceUnresolved =
    !scenarioControlled &&
    !useClientCadencePicker &&
    libraryTactics.length > 0 &&
    selectedLibraryRow != null &&
    timingProfileResolvedLibrary === null;

  const timingProfileForApi: ScenarioTactic | null = scenarioControlled
    ? (scenarioTacticProp ?? null)
    : useClientCadencePicker
      ? fallbackTimingProfile
      : libraryTactics.length === 0
        ? fallbackTimingProfile
        : (timingProfileResolvedLibrary ?? fallbackTimingProfile);

  const timingProfileEffective: ScenarioTactic = timingProfileForApi ?? fallbackTimingProfile;

  /** Reset cadence when client context changes and current profile is outside the new client’s list (local or parent-controlled). */
  useEffect(() => {
    if (!hasPlannerClientFamily) return;
    const ids = cadenceOptionIds;
    if (!ids.length) return;

    if (!scenarioControlled) {
      setFallbackTimingProfile((prev) => {
        if (ids.includes(prev)) return prev;
        const inferred = inferTimingProfileFromProject(projectCadenceContext);
        const next = (inferred && ids.includes(inferred) ? inferred : ids[0])!;
        queueMicrotask(() => onScenarioTacticChangeRef.current?.(next));
        return next;
      });
      return;
    }

    const cur = scenarioTacticProp;
    if (cur != null && ids.includes(cur)) return;
    const inferred = inferTimingProfileFromProject(projectCadenceContext);
    const next = (inferred && ids.includes(inferred) ? inferred : ids[0])!;
    queueMicrotask(() => onScenarioTacticChangeRef.current?.(next));
  }, [
    scenarioControlled,
    hasPlannerClientFamily,
    cadenceOptionIds,
    projectCadenceContext,
    scenarioTacticProp,
  ]);

  /** Phases for checkbox toggles and needed-by milestone picker — matches worker linear planner for this profile. */
  const plannerPhaseSteps = useMemo(() => {
    if (libraryCadenceUnresolved) return [];
    return getScenarioStepsOrdered(timingProfileEffective, catalogTacticKey);
  }, [libraryCadenceUnresolved, timingProfileEffective, catalogTacticKey]);

  useEffect(() => {
    if (!enabled) return;
    if (scenarioControlled && !hasPlannerClientFamily) return;
    let cancelled = false;
    setLibraryLoading(true);
    listTacticsLibrary()
      .then((rows) => {
        if (cancelled) return;
        const list = filterLibraryRowsForAttach(Array.isArray(rows) ? rows : []);
        setLibraryTactics(list);
        setLibraryErr(null);
        setSelectedLibraryTacticId((prev) => {
          if (prev && list.some((x) => String(x.id) === prev)) return prev;
          return list[0]?.id != null ? String(list[0].id) : '';
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setLibraryTactics([]);
        setLibraryErr(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLibraryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, scenarioControlled, hasPlannerClientFamily]);

  const selectedLibraryDescription =
    selectedLibraryRow && typeof selectedLibraryRow.description === 'string' && selectedLibraryRow.description.trim()
      ? String(selectedLibraryRow.description).trim()
      : null;
  const [complexity, setComplexity] = useState<ScenarioComplexity>('medium');
  const [planningMode, setPlanningMode] = useState<ScenarioPlanningMode>('kickoff');
  const liveTodayIso = useLocalTodayIso();
  /** When null, kickoff follows {@link liveTodayIso} (updates at local midnight). */
  const [kickoffOverrideIso, setKickoffOverrideIso] = useState<string | null>(null);
  const anchorIso = kickoffOverrideIso ?? liveTodayIso;
  /** When null, needed-by date follows {@link liveTodayIso}. */
  const [neededByOverrideIso, setNeededByOverrideIso] = useState<string | null>(null);
  const neededByIso = neededByOverrideIso ?? liveTodayIso;
  const [anchorPhaseId, setAnchorPhaseId] = useState('release_assets_vendors');
  const [clientReviewExtra, setClientReviewExtra] = useState(0);
  /** When true, phase uses calendar days and may land on weekends/holidays. */
  const [phaseAllowNonWorking, setPhaseAllowNonWorking] = useState<Record<string, boolean>>({});
  const [activeModifierIds, setActiveModifierIds] = useState<string[]>([]);
  const [skillArtsPageCount, setSkillArtsPageCount] = useState(DEFAULT_SKILLARTS_PAGE_COUNT);

  /** SkillArts uses page tiers instead of complexity; keep complexity fixed at medium for non-PRB scaling and PRB rounds. */
  const complexityForApi = useMemo(
    (): ScenarioComplexity =>
      usesSkillArtsTieredPrbCadence(timingProfileEffective) ? 'medium' : complexity,
    [timingProfileEffective, complexity],
  );

  const [scenarioUploadSaving, setScenarioUploadSaving] = useState(false);
  const [optionsExpanded, setOptionsExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    if (localStorage.getItem(LS_OPTIONS) != null) return readLsBool(LS_OPTIONS, true);
    if (localStorage.getItem(LS_OPTIONS_LEGACY) != null) return readLsBool(LS_OPTIONS_LEGACY, true);
    return true;
  });
  const [modifiersExpanded, setModifiersExpanded] = useState(() => readLsBool(LS_MODIFIERS, true));
  const [breakdownExpanded, setBreakdownExpanded] = useState(() => readLsBool(LS_BREAKDOWN, true));

  const { from: holFrom, to: holTo } = useMemo(() => {
    if (planningMode === 'kickoff') return holidayRangeForKickoff(anchorIso);
    const earliestInWindow = addCalendarDaysUTC(neededByIso, -KICKOFF_DEADLINE_SEARCH_WINDOW_DAYS);
    return holidayRangeSpanning(earliestInWindow, neededByIso);
  }, [planningMode, anchorIso, neededByIso]);

  const { holidaySet, loading: holidaysLoading, error: holidaysError } = useHolidays(holFrom, holTo);
  const holidaysForApi = useMemo(() => Array.from(holidaySet).sort(), [holidaySet]);

  const [computedSteps, setComputedSteps] = useState<HalTimelineStep[] | null>(null);
  const [workingSteps, setWorkingSteps] = useState<HalTimelineStep[] | null>(null);
  const [opdpBinderSteps, setOpdpBinderSteps] = useState<HalTimelineStep[] | null>(null);
  const [breakdown, setBreakdown] = useState<LinearStepBreakdown[] | null>(null);
  const [computeError, setComputeError] = useState<string | null>(null);
  const [computeLoading, setComputeLoading] = useState(false);
  const [derivedKickoffIso, setDerivedKickoffIso] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const prevManualDirty = useRef(false);

  const manualDirty = useMemo(
    () =>
      computedSteps != null &&
      workingSteps != null &&
      !halTimelineStepsEqual(computedSteps, workingSteps),
    [computedSteps, workingSteps],
  );

  const scenarioSpineLength = useMemo(() => {
    if (libraryCadenceUnresolved) return 0;
    return getScenarioStepsOrdered(timingProfileEffective, catalogTacticKey).length;
  }, [libraryCadenceUnresolved, timingProfileEffective, catalogTacticKey]);

  /** Last index where working differs from last worker compute; suffix recompute pins `0..index`. */
  const recomputeFreezeAfterIndex = useMemo(() => {
    if (!computedSteps?.length || !workingSteps?.length || computedSteps.length !== workingSteps.length) {
      return -1;
    }
    let last = -1;
    for (let i = 0; i < workingSteps.length; i++) {
      if (!halTimelineStepsEqual([computedSteps[i]!], [workingSteps[i]!])) last = i;
    }
    return last;
  }, [computedSteps, workingSteps]);

  const [recomputeSuffixLoading, setRecomputeSuffixLoading] = useState(false);

  useEffect(() => {
    if (manualDirty && !prevManualDirty.current) {
      setBreakdownExpanded(false);
    }
    prevManualDirty.current = manualDirty;
  }, [manualDirty]);

  useEffect(() => {
    if (!enabled) {
      setComputedSteps(null);
      setWorkingSteps(null);
      setOpdpBinderSteps(null);
      setBreakdown(null);
      setComputeError(null);
      setDerivedKickoffIso(null);
      setComputeLoading(false);
      return;
    }

    if (holidaysLoading) {
      setComputeLoading(true);
      return;
    }

    if (libraryCadenceUnresolved || timingProfileForApi === null) {
      setComputeLoading(false);
      setComputeError(
        'PRB cadence could not be resolved for this tactic. Set timing_profile on the tactic in the library (or in config/tactic_library/catalog.json), or use a project whose workspace/client maps to a default cadence.',
      );
      setComputedSteps(null);
      setWorkingSteps(null);
      setOpdpBinderSteps(null);
      setBreakdown(null);
      setDerivedKickoffIso(null);
      return;
    }

    const ac = new AbortController();

    (async () => {
      setComputeLoading(true);
      setComputeError(null);
      setComputedSteps(null);
      setWorkingSteps(null);
      setOpdpBinderSteps(null);
      setBreakdown(null);
      setDerivedKickoffIso(null);
      try {
        const shared: Record<string, unknown> = {
          timingProfile: timingProfileForApi,
          tactic: timingProfileForApi,
          complexity: complexityForApi,
          clientReviewExtraCalendarDays: clientReviewExtra,
          holidays: holidaysForApi,
          phaseAllowNonWorkingDays: phaseAllowNonWorking,
          activeModifierIds,
          ...(catalogTacticKey ? { catalogTacticKey } : {}),
          ...(usesSkillArtsTieredPrbCadence(timingProfileForApi) ? { pageCount: skillArtsPageCount } : {}),
        };
        if (planningMode === 'kickoff') {
          const result = await postComputeScenarioSteps({ ...shared, anchorStartIso: anchorIso }, ac.signal);
          if (ac.signal.aborted) return;
          if (result.ok === false) {
            setComputeError(result.error);
            return;
          }
          setComputedSteps(result.steps);
          setWorkingSteps(result.steps);
          setOpdpBinderSteps(
            result.opdp_binder_steps && result.opdp_binder_steps.length ? result.opdp_binder_steps : null,
          );
          setBreakdown(result.breakdown.length ? result.breakdown : null);
        } else {
          const result = await postFindLatestKickoffForDeadline(
            { ...shared, deadlineIso: neededByIso, anchorPhaseId },
            ac.signal,
          );
          if (ac.signal.aborted) return;
          if (result.ok === false) {
            setComputeError(result.error);
            return;
          }
          setComputedSteps(result.steps);
          setWorkingSteps(result.steps);
          setOpdpBinderSteps(null);
          setBreakdown(result.breakdown.length ? result.breakdown : null);
          setDerivedKickoffIso(result.kickoffIso);
        }
      } catch (e: unknown) {
        if (ac.signal.aborted) return;
        const msg = e instanceof Error ? e.message : String(e);
        setComputeError(
          `${msg} If this persists, open Queue & workers and check the scenario planner worker.`,
        );
      } finally {
        if (!ac.signal.aborted) setComputeLoading(false);
      }
    })();

    return () => ac.abort();
  }, [
    enabled,
    holidaysLoading,
    holidaysForApi,
    planningMode,
    timingProfileEffective,
    timingProfileForApi,
    libraryCadenceUnresolved,
    complexityForApi,
    anchorIso,
    neededByIso,
    anchorPhaseId,
    clientReviewExtra,
    phaseAllowNonWorking,
    activeModifierIds,
    skillArtsPageCount,
    catalogTacticKey,
  ]);

  const payload = useMemo(() => {
    if (!enabled || !workingSteps) return null;
    if (validateHalTimelineSteps(workingSteps) !== null) return null;
    return buildScenarioPayloadFromSteps(workingSteps);
  }, [enabled, workingSteps]);

  const preview = useMemo(
    () => (workingSteps && workingSteps.length ? computeTimelinePreview(workingSteps) : null),
    [workingSteps],
  );
  const keyDateRows = useMemo(() => {
    if (!workingSteps) return [];
    const base = stepsToKeyDateRows(workingSteps, breakdown);
    if (complexityForApi === 'complex') return enrichComplexScenarioKeyDateRows(base, holidaySet);
    if (complexityForApi === 'basic')
      return enrichComplexScenarioKeyDateRows(base, holidaySet, BASIC_KEY_DATE_MAX_CONSECUTIVE_WD);
    return base;
  }, [workingSteps, breakdown, complexityForApi, holidaySet]);

  const cbRef = useRef(onScenarioChange);
  cbRef.current = onScenarioChange;
  useEffect(() => {
    cbRef.current(enabled ? payload : null);
  }, [enabled, payload]);

  /** Needed-by anchor must exist on the current spine (e.g. SkillArts RTE vs schematic catalog). */
  useEffect(() => {
    const ids = new Set(plannerPhaseSteps.map((s) => s.id));
    setAnchorPhaseId((prev) => {
      if (ids.has(prev)) return prev;
      const last = plannerPhaseSteps[plannerPhaseSteps.length - 1];
      return last?.id ?? prev;
    });
  }, [plannerPhaseSteps]);

  useEffect(() => {
    writeLsBool(LS_OPTIONS, optionsExpanded);
  }, [optionsExpanded]);

  useEffect(() => {
    writeLsBool(LS_MODIFIERS, modifiersExpanded);
  }, [modifiersExpanded]);

  useEffect(() => {
    writeLsBool(LS_BREAKDOWN, breakdownExpanded);
  }, [breakdownExpanded]);

  const togglePhaseAllow = useCallback((phaseId: string, checked: boolean) => {
    setPhaseAllowNonWorking((prev) => {
      const next = { ...prev };
      if (checked) next[phaseId] = true;
      else delete next[phaseId];
      return next;
    });
  }, []);

  const toggleModifier = useCallback((modifierId: string, checked: boolean) => {
    setActiveModifierIds((prev) => {
      if (checked) return prev.includes(modifierId) ? prev : [...prev, modifierId];
      return prev.filter((id) => id !== modifierId);
    });
  }, []);

  const onWorkingStepChange = useCallback((index: number, next: HalTimelineStep) => {
    setWorkingSteps((prev) => {
      if (!prev || index < 0 || index >= prev.length) return prev;
      const copy = [...prev];
      copy[index] = next;
      return copy;
    });
  }, []);

  const onWorkingStepsReplace = useCallback((next: HalTimelineStep[]) => {
    setWorkingSteps(next);
  }, []);

  const onCalendarShiftStepToDay = useCallback((stepIndex: number, targetIso: string) => {
    setWorkingSteps((prev) => {
      if (!prev || stepIndex < 0 || stepIndex >= prev.length) return prev;
      const copy = [...prev];
      copy[stepIndex] = shiftStepToStartDate(prev[stepIndex]!, targetIso);
      return copy;
    });
  }, []);

  const resetWorkingToComputed = useCallback(() => {
    if (computedSteps) setWorkingSteps(computedSteps);
  }, [computedSteps]);

  const recomputeSuffix = useCallback(async () => {
    if (
      planningMode !== 'kickoff' ||
      !timingProfileForApi ||
      libraryCadenceUnresolved ||
      !workingSteps?.length ||
      recomputeFreezeAfterIndex < 0
    ) {
      return;
    }
    if (workingSteps.length !== scenarioSpineLength) {
      setImportErr('Recompute requires the same number of phases as the tactic spine (reset or re-import a full spine).');
      return;
    }
    const err = validateHalTimelineSteps(workingSteps);
    if (err != null) {
      setImportErr(err);
      return;
    }
    setRecomputeSuffixLoading(true);
    setImportErr(null);
    setComputeError(null);
    try {
      const prefix = workingSteps.slice(0, recomputeFreezeAfterIndex + 1);
      const body: Record<string, unknown> = {
        timingProfile: timingProfileForApi,
        tactic: timingProfileForApi,
        complexity: complexityForApi,
        clientReviewExtraCalendarDays: clientReviewExtra,
        holidays: holidaysForApi,
        phaseAllowNonWorkingDays: phaseAllowNonWorking,
        activeModifierIds,
        anchorStartIso: anchorIso,
        freezeAfterStepIndex: recomputeFreezeAfterIndex,
        pinnedPrefixSteps: prefix,
        ...(catalogTacticKey ? { catalogTacticKey } : {}),
        ...(usesSkillArtsTieredPrbCadence(timingProfileForApi) ? { pageCount: skillArtsPageCount } : {}),
      };
      const result = await postComputeScenarioSteps(body);
      if (result.ok === false) {
        setComputeError(result.error);
        return;
      }
      setComputedSteps(result.steps);
      setWorkingSteps(result.steps);
      setOpdpBinderSteps(
        result.opdp_binder_steps && result.opdp_binder_steps.length ? result.opdp_binder_steps : null,
      );
      setBreakdown(result.breakdown.length ? result.breakdown : null);
    } catch (e: unknown) {
      setComputeError(e instanceof Error ? e.message : String(e));
    } finally {
      setRecomputeSuffixLoading(false);
    }
  }, [
    planningMode,
    timingProfileForApi,
    libraryCadenceUnresolved,
    workingSteps,
    recomputeFreezeAfterIndex,
    scenarioSpineLength,
    complexityForApi,
    clientReviewExtra,
    holidaysForApi,
    phaseAllowNonWorking,
    activeModifierIds,
    anchorIso,
    skillArtsPageCount,
  ]);

  const downloadWorkingCsv = useCallback(() => {
    if (!workingSteps?.length) return;
    const err = validateHalTimelineSteps(workingSteps);
    if (err != null) {
      setImportErr(err);
      return;
    }
    try {
      const csv = halTimelineStepsToCsv(workingSteps);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeTactic = timingProfileEffective.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 32) || 'tactic';
      a.href = url;
      a.download = `delivery-scenario-${safeTactic}-edited.csv`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setImportErr(null);
    } catch (e: unknown) {
      setImportErr(e instanceof Error ? e.message : String(e));
    }
  }, [workingSteps, timingProfileEffective]);

  const onPickImportFile = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const onImportCsvFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    void f.text().then((text) => {
      const parsed = parseHalTimelineCsv(text);
      if (parsed.ok === false) {
        setImportErr(parsed.error);
        return;
      }
      setImportErr(null);
      setWorkingSteps(parsed.steps);
    });
  }, []);

  const addScenarioToProject = useCallback(async () => {
    if (!projectKey.trim() || !workingSteps || computeError) return;
    setScenarioUploadSaving(true);
    try {
      const csv = halTimelineStepsToCsv(workingSteps);
      const safeTactic = timingProfileEffective.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 32) || 'tactic';
      const modSuffix =
        activeModifierIds.length > 0 ? `-${activeModifierIds.sort().join('_')}` : '';
      const dateSlug =
        planningMode === 'needed_by'
          ? `needed-by-${neededByIso}${derivedKickoffIso ? `-kickoff-${derivedKickoffIso}` : ''}`
          : anchorIso;
      const name = `delivery-scenario-${safeTactic}${modSuffix}-${dateSlug}.csv`;
      const file = new File([csv], name, { type: 'text/csv;charset=utf-8' });
      await uploadProjectDocument(projectKey.trim(), file, 'scenario');
      onScenarioProjectSave?.(
        `Saved “${name}” to project files as kind scenario (CSV). Open Workspaces → Project files to download.`,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      onScenarioProjectSaveError?.(msg);
    } finally {
      setScenarioUploadSaving(false);
    }
  }, [
    projectKey,
    workingSteps,
    computeError,
    timingProfileEffective,
    planningMode,
    neededByIso,
    derivedKickoffIso,
    anchorIso,
    activeModifierIds,
    onScenarioProjectSave,
    onScenarioProjectSaveError,
  ]);

  if (!enabled) return null;

  return (
    <div className="mt-2 rounded-md border border-fuchsia-200/80 bg-fuchsia-50/50 p-2 dark:border-fuchsia-500/30 dark:bg-fuchsia-500/10">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-fuchsia-900 dark:text-fuchsia-100">
        Delivery scenario
      </div>
      <p className="mt-0.5 text-[10px] leading-snug text-fuchsia-950/85 dark:text-fuchsia-100/90">
        Compute a delivery schedule, preview it, and save CSV to project files. Use <span className="font-medium">Start from kickoff</span> to plan forward, or <span className="font-medium">Need delivery by</span> to work backward
        (latest kickoff for a chosen milestone end on or before your date). Plans are computed via the API (scenario planner worker). Baseline business days live in{' '}
        <span className="font-mono">config/scenario_planner/</span>; optional modifiers stack additively.
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-b border-fuchsia-900/15 pb-1.5 dark:border-fuchsia-100/15">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-fuchsia-900 dark:text-fuchsia-100">
          Scenario options
        </span>
        <button
          type="button"
          className="flex shrink-0 items-center justify-center rounded px-1 py-0.5 text-app-muted hover:bg-app-fill-hover"
          aria-expanded={optionsExpanded}
          aria-controls="scenario-planner-options-body"
          aria-label={optionsExpanded ? 'Collapse scenario options' : 'Expand scenario options'}
          onClick={() => setOptionsExpanded((v) => !v)}
        >
          <PanelChevron expanded={optionsExpanded} />
        </button>
      </div>

      {optionsExpanded ? (
        <div id="scenario-planner-options-body" className="min-w-0">
          <div className="mt-2 flex flex-wrap gap-4 text-[10px]">
            <span className="font-medium text-app-muted">Planning</span>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-app-text">
              <input
                type="radio"
                name="scenario-planning-mode"
                className="rounded-full border-app-border"
                checked={planningMode === 'kickoff'}
                onChange={() => setPlanningMode('kickoff')}
              />
              Start from kickoff
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-app-text">
              <input
                type="radio"
                name="scenario-planning-mode"
                className="rounded-full border-app-border"
                checked={planningMode === 'needed_by'}
                onChange={() => setPlanningMode('needed_by')}
              />
              Need delivery by
            </label>
          </div>

          <div className="mt-2 flex flex-wrap items-start gap-3">
            {scenarioControlled && !hasPlannerClientFamily && scenarioTacticProp != null ? (
              <div className="block min-w-[10rem] text-[10px] font-medium text-app-muted">
                Timing profile
                <div className="mt-0.5 rounded-md border border-app-border bg-app-fill/80 px-2 py-1.5 text-[11px] text-app-text">
                  {scenarioTacticLabel(scenarioTacticProp)}
                </div>
              </div>
            ) : libraryLoading && !useClientCadencePicker && !mappedClientCadenceInControlledMode ? (
              <div className="block min-w-[12rem] text-[10px] font-medium text-app-muted">
                Tactic library
                <div className="mt-0.5 rounded-md border border-app-border bg-app-fill/80 px-2 py-1.5 text-[11px] text-app-muted">
                  Loading…
                </div>
              </div>
            ) : (
              <>
                {showCadenceTimelineRow ? (
                  <label className="block min-w-[12rem] max-w-[24rem] flex-1 text-[10px] font-medium text-app-muted">
                    Cadence / timeline
                    <select
                      value={cadenceSelectValue}
                      onChange={(e) => {
                        const v = e.target.value as ScenarioTactic;
                        if (!scenarioControlled) setFallbackTimingProfile(v);
                        onScenarioTacticChange?.(v);
                      }}
                      className="mt-0.5 w-full rounded-md border border-app-border bg-app-surface p-1.5 text-[11px] text-app-text"
                    >
                      {cadenceRowOptionIds.map((t) => (
                        <option key={t} value={t}>
                          {scenarioTacticLabel(t as ScenarioTactic)}
                        </option>
                      ))}
                    </select>
                    <div className="mt-0.5 max-w-md text-[9px] leading-snug text-app-muted">
                      {useClientCadencePicker || mappedClientCadenceInControlledMode
                        ? 'Profiles for this brand (DB default or repo catalog). Pick before or without a marketing tactic.'
                        : libraryErr
                          ? 'Could not load the tactic library from the API.'
                          : 'No active tactics returned — run scripts/apply-tactic-library-seed.sh against Postgres (see README) or add tactics from Workspaces. Full timing profile list below until the library is available.'}
                    </div>
                    {mappedClientCadenceInControlledMode || useClientCadencePicker ? (
                      <CadenceSourceBadge
                        source={cadenceSource}
                        timingProfileEffective={timingProfileEffective}
                        brandTimingProfileId={brandTimingProfileId}
                        projectTimingProfileId={projectTimingProfileId}
                        brandId={brandId}
                        projectKey={projectKey}
                        onSaveCadenceAsBrandDefault={onSaveCadenceAsBrandDefault}
                        onSaveCadenceAsProjectDefault={onSaveCadenceAsProjectDefault}
                      />
                    ) : null}
                    {libraryErr && !useClientCadencePicker && !mappedClientCadenceInControlledMode ? (
                      <div className="mt-0.5 text-[9px] text-rose-600 dark:text-rose-300">{libraryErr}</div>
                    ) : null}
                  </label>
                ) : null}
                {libraryLoading && (useClientCadencePicker || mappedClientCadenceInControlledMode) ? (
                  <div className="block min-w-[10rem] text-[9px] font-medium text-app-muted/90">
                    Loading optional tactic library…
                  </div>
                ) : null}
                {!libraryLoading && libraryTactics.length > 0 ? (
                  <label className="block min-w-[12rem] max-w-[22rem] flex-1 text-[10px] font-medium text-app-muted">
                    Tactic library
                    {useClientCadencePicker || mappedClientCadenceInControlledMode ? ' (optional)' : ''}
                    <select
                      value={selectedLibraryTacticId}
                      onChange={(e) => setSelectedLibraryTacticId(e.target.value)}
                      className="mt-0.5 w-full rounded-md border border-app-border bg-app-surface p-1.5 text-[11px] text-app-text"
                    >
                      {groupedLibrary.map(([ch, rows]) => (
                        <optgroup key={ch} label={ch}>
                          {rows.map((row) => (
                            <option key={String(row.id)} value={String(row.id)}>
                              {typeof row.name === 'string' ? row.name : String(row.key ?? row.id)}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {libraryErr ? (
                      <div className="mt-0.5 text-[9px] text-rose-600 dark:text-rose-300">{libraryErr}</div>
                    ) : useClientCadencePicker || mappedClientCadenceInControlledMode ? (
                      <div className="mt-0.5 text-[9px] text-app-muted">
                        Optional — does not change cadence above. Use for alignment or when attaching this scenario to
                        a job.
                      </div>
                    ) : (
                      <div className="mt-0.5 text-[9px] text-app-muted">
                        {libraryCadenceUnresolved ? (
                          <span className="text-rose-600 dark:text-rose-300">
                            Cadence unresolved — set timing_profile on this tactic, add it to tactic_library catalog, or
                            use a project whose client maps to a default cadence.
                          </span>
                        ) : (
                          <>Resolved timing: {scenarioTacticLabel(timingProfileEffective)}</>
                        )}
                      </div>
                    )}
                    {selectedLibraryDescription ? (
                      <div className="mt-1 max-w-[22rem] text-[9px] leading-snug text-app-muted">
                        {selectedLibraryDescription}
                      </div>
                    ) : null}
                  </label>
                ) : null}
              </>
            )}
            {usesSkillArtsTieredPrbCadence(timingProfileEffective) ? (
              <label className="block min-w-[12rem] text-[10px] font-medium text-app-muted">
                Tier
                <select
                  value={skillArtsTierFromPageCount(skillArtsPageCount)}
                  onChange={(e) =>
                    setSkillArtsPageCount(
                      canonicalPageCountForSkillArtsTier(e.target.value as SkillArtsTierId),
                    )
                  }
                  className="mt-0.5 w-full rounded-md border border-app-border bg-app-surface p-1.5 text-[11px] text-app-text"
                >
                  {SKILL_ARTS_TIER_IDS.map((tid) => (
                    <option key={tid} value={tid}>
                      {SKILL_ARTS_TIER_LABEL[tid]}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="block min-w-[7rem] text-[10px] font-medium text-app-muted">
                Complexity
                <select
                  value={complexity}
                  onChange={(e) => setComplexity(e.target.value as ScenarioComplexity)}
                  className="mt-0.5 w-full rounded-md border border-app-border bg-app-surface p-1.5 text-[11px] text-app-text"
                >
                  {SCENARIO_COMPLEXITIES.map((c) => (
                    <option key={c} value={c}>
                      {scenarioComplexityLabel(c)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {usesSkillArtsTieredPrbCadence(timingProfileEffective) ? (
              <label className="block min-w-[8rem] text-[10px] font-medium text-app-muted">
                Page count (SkillArts)
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={skillArtsPageCount}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setSkillArtsPageCount(
                      Number.isFinite(n) ? Math.min(5000, Math.max(1, Math.floor(n))) : DEFAULT_SKILLARTS_PAGE_COUNT,
                    );
                  }}
                  className="mt-0.5 w-full rounded-md border border-app-border bg-app-surface p-1.5 text-[11px] text-app-text"
                />
              </label>
            ) : null}
            {planningMode === 'kickoff' ? (
              <div className="block min-w-[9rem]">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-medium text-app-muted">
                  <label htmlFor="scenario-planner-kickoff" className="cursor-default">
                    Kickoff date
                  </label>
                  {kickoffOverrideIso !== null ? (
                    <button
                      type="button"
                      className="font-normal text-fuchsia-700 underline decoration-fuchsia-400/80 hover:text-fuchsia-900 dark:text-fuchsia-200 dark:hover:text-fuchsia-50"
                      onClick={() => setKickoffOverrideIso(null)}
                    >
                      Use today
                    </button>
                  ) : (
                    <span className="font-normal text-app-muted">(today, local)</span>
                  )}
                </div>
                <input
                  id="scenario-planner-kickoff"
                  type="date"
                  value={anchorIso}
                  onChange={(e) => setKickoffOverrideIso(e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-app-border bg-app-surface p-1.5 text-[11px] text-app-text"
                />
              </div>
            ) : (
              <>
                <div className="block min-w-[9rem]">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-medium text-app-muted">
                    <label htmlFor="scenario-planner-needed-by" className="cursor-default">
                      Needed-by date
                    </label>
                    {neededByOverrideIso !== null ? (
                      <button
                        type="button"
                        className="font-normal text-fuchsia-700 underline decoration-fuchsia-400/80 hover:text-fuchsia-900 dark:text-fuchsia-200 dark:hover:text-fuchsia-50"
                        onClick={() => setNeededByOverrideIso(null)}
                      >
                        Use today
                      </button>
                    ) : (
                      <span className="font-normal text-app-muted">(today, local)</span>
                    )}
                  </div>
                  <input
                    id="scenario-planner-needed-by"
                    type="date"
                    value={neededByIso}
                    onChange={(e) => setNeededByOverrideIso(e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-app-border bg-app-surface p-1.5 text-[11px] text-app-text"
                  />
                </div>
                <label className="block min-w-[12rem] text-[10px] font-medium text-app-muted">
                  Milestone (phase end ≤ date)
                  <select
                    value={anchorPhaseId}
                    onChange={(e) => setAnchorPhaseId(e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-app-border bg-app-surface p-1.5 text-[11px] text-app-text"
                  >
                    {plannerPhaseSteps.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <label className="block min-w-[10rem] text-[10px] font-medium text-app-muted">
              Extra days on client reviews
              <input
                type="number"
                min={0}
                max={60}
                step={1}
                value={clientReviewExtra}
                onChange={(e) => setClientReviewExtra(Number(e.target.value) || 0)}
                className="mt-0.5 w-full rounded-md border border-app-border bg-app-surface p-1.5 text-[11px] text-app-text"
              />
            </label>
          </div>

          <div className="mt-3 rounded border border-app-border/80 bg-app-surface/40 p-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-fuchsia-900/15 pb-1.5 dark:border-fuchsia-100/15">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-fuchsia-900 dark:text-fuchsia-100">
                Stackable modifiers
              </span>
              <button
                type="button"
                className="flex shrink-0 items-center justify-center rounded px-1 py-0.5 text-app-muted hover:bg-app-fill-hover"
                aria-expanded={modifiersExpanded}
                aria-controls="scenario-planner-modifiers-body"
                aria-label={modifiersExpanded ? 'Collapse stackable modifiers' : 'Expand stackable modifiers'}
                onClick={() => setModifiersExpanded((v) => !v)}
              >
                <PanelChevron expanded={modifiersExpanded} />
              </button>
            </div>
            {modifiersExpanded ? (
              <div id="scenario-planner-modifiers-body" className="min-w-0">
                <p className="mt-2 text-[9px] leading-snug text-app-muted">
                  Deltas from <span className="font-mono">config/scenario_planner/tactics/</span>; summed in the order
                  selected.
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {MODIFIERS_REGISTRY.modifiers.map((m) => (
                    <label
                      key={m.id}
                      className="flex cursor-pointer items-start gap-2 rounded px-0.5 py-0.5 hover:bg-app-fill-hover"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-app-border"
                        checked={activeModifierIds.includes(m.id)}
                        onChange={(e) => toggleModifier(m.id, e.target.checked)}
                      />
                      <span className="text-[10px] leading-snug text-app-text">
                        <span className="font-mono">{m.id}</span>
                        {m.description ? (
                          <span className="block text-[9px] text-app-muted">{m.description}</span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {holidaysLoading ? (
            <p className="mt-2 text-[10px] text-app-muted">Loading US federal holidays…</p>
          ) : null}
          {holidaysError ? (
            <p className="mt-2 text-[10px] text-amber-800 dark:text-amber-200">
              Could not load holidays ({holidaysError}). Scheduling uses weekends only (no federal holiday set).
            </p>
          ) : null}

          <div className="mt-2 max-h-40 overflow-y-auto rounded border border-app-border/80 bg-app-surface/40">
            <table className="w-full text-left text-[9px]">
              <thead className="sticky top-0 bg-app-fill/95 text-app-muted">
                <tr>
                  <th className="px-1 py-0.5">Phase</th>
                  <th className="px-1 py-0.5 whitespace-nowrap">Allow non-working days</th>
                </tr>
              </thead>
              <tbody>
                {plannerPhaseSteps.map((row) => (
                  <tr key={row.id} className="border-t border-app-border/60">
                    <td className="px-1 py-0.5 text-app-text">{row.label}</td>
                    <td className="px-1 py-0.5">
                      <label className="inline-flex cursor-pointer items-center gap-1">
                        <input
                          type="checkbox"
                          checked={phaseAllowNonWorking[row.id] === true}
                          onChange={(e) => togglePhaseAllow(row.id, e.target.checked)}
                          className="rounded border-app-border"
                        />
                        <span className="text-app-muted">Calendar days</span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {computeError ? (
        <p className="mt-2 text-[11px] text-rose-700 dark:text-rose-300">{computeError}</p>
      ) : null}

      {computeLoading && !holidaysLoading ? (
        <p className="mt-2 text-[11px] text-app-muted">Computing schedule…</p>
      ) : null}

      {preview && !computeError && !computeLoading ? (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-fuchsia-950/90 dark:text-fuchsia-100/90">
            <span className="font-semibold">Summary:</span> {preview.step_count} steps,{' '}
            <span className="font-mono">{preview.overall_start_date}</span> →{' '}
            <span className="font-mono">{preview.overall_end_date}</span>
            {derivedKickoffIso ? (
              <>
                {' '}
                · <span className="font-semibold">Latest kickoff:</span>{' '}
                <span className="font-mono">{derivedKickoffIso}</span>
              </>
            ) : null}
          </p>
          {workingSteps && !computeError ? (
            <p className="text-[10px] text-fuchsia-950/85 dark:text-fuchsia-100/85">
              <span className="font-semibold">PRB:</span> {prbCadenceSummary(workingSteps, breakdown)}
              {manualDirty ? (
                <span className="text-app-muted"> · includes manual date edits</span>
              ) : null}
            </p>
          ) : null}
          {manualDirty ? (
            <p className="text-[10px] font-medium text-amber-900 dark:text-amber-100/95">
              Manual overrides active — per-step breakdown and OPDP binder reflect the last compute, not necessarily
              edited dates.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!manualDirty || !computedSteps}
              onClick={resetWorkingToComputed}
              className="rounded-md border border-app-border bg-app-surface px-2.5 py-1 text-[10px] font-semibold text-app-text hover:bg-app-fill-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Reset to computed
            </button>
            <button
              type="button"
              title={
                planningMode !== 'kickoff'
                  ? 'Recompute rest is only available in “Start from kickoff” mode.'
                  : recomputeFreezeAfterIndex < 0
                    ? 'No differences from the last compute to anchor a recompute.'
                    : workingSteps && workingSteps.length !== scenarioSpineLength
                      ? 'Row count must match the tactic spine.'
                      : undefined
              }
              disabled={
                planningMode !== 'kickoff' ||
                !manualDirty ||
                !workingSteps?.length ||
                !!computeError ||
                computeLoading ||
                recomputeSuffixLoading ||
                libraryCadenceUnresolved ||
                timingProfileForApi === null ||
                recomputeFreezeAfterIndex < 0 ||
                workingSteps.length !== scenarioSpineLength ||
                validateHalTimelineSteps(workingSteps) !== null
              }
              onClick={() => void recomputeSuffix()}
              className="rounded-md border border-app-border bg-app-surface px-2.5 py-1 text-[10px] font-semibold text-app-text hover:bg-app-fill-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {recomputeSuffixLoading ? 'Recomputing…' : 'Recompute rest'}
            </button>
            <button
              type="button"
              disabled={!workingSteps?.length || !!computeError || computeLoading}
              onClick={downloadWorkingCsv}
              className="rounded-md border border-app-border bg-app-surface px-2.5 py-1 text-[10px] font-semibold text-app-text hover:bg-app-fill-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Download CSV
            </button>
            <button
              type="button"
              disabled={!!computeError || computeLoading}
              onClick={onPickImportFile}
              className="rounded-md border border-app-border bg-app-surface px-2.5 py-1 text-[10px] font-semibold text-app-text hover:bg-app-fill-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Import CSV…
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              aria-hidden
              onChange={onImportCsvFile}
            />
            <button
              type="button"
              disabled={
                !projectKey.trim() ||
                !workingSteps ||
                !!computeError ||
                computeLoading ||
                scenarioUploadSaving ||
                validateHalTimelineSteps(workingSteps) !== null
              }
              onClick={() => void addScenarioToProject()}
              className="rounded-md bg-fuchsia-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {scenarioUploadSaving ? 'Saving…' : 'Add scenario to project'}
            </button>
            {!projectKey.trim() ? (
              <span className="text-[9px] text-app-muted">
                Select a project in the sidebar to save CSV to project files (schedule works brand-only).
              </span>
            ) : (
              <span className="text-[9px] text-app-muted">
                Stored as <span className="font-mono">scenario</span> (not timeline) — no automatic timeline extraction.
              </span>
            )}
          </div>
        </div>
      ) : null}

      {breakdown &&
      breakdown.length > 0 &&
      workingSteps &&
      workingSteps.length === breakdown.length &&
      !computeError &&
      !computeLoading ? (
        <div className="mt-2 rounded border border-app-border/80 bg-app-surface/40 p-2">
          {manualDirty ? (
            <p className="mb-2 rounded border border-amber-400/50 bg-amber-50/80 px-2 py-1 text-[9px] text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-50/95">
              Stale: breakdown numbers are from the planner worker; Start/End columns show your edited schedule.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-fuchsia-900/15 pb-1.5 dark:border-fuchsia-100/15">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-fuchsia-900 dark:text-fuchsia-100">
              Per-step breakdown (business-day math)
            </span>
            <button
              type="button"
              className="flex shrink-0 items-center justify-center rounded px-1 py-0.5 text-app-muted hover:bg-app-fill-hover"
              aria-expanded={breakdownExpanded}
              aria-controls="scenario-planner-breakdown-body"
              aria-label={breakdownExpanded ? 'Collapse per-step breakdown' : 'Expand per-step breakdown'}
              onClick={() => setBreakdownExpanded((v) => !v)}
            >
              <PanelChevron expanded={breakdownExpanded} />
            </button>
          </div>
          {breakdownExpanded ? (
            <div id="scenario-planner-breakdown-body" className="max-h-56 min-w-0 overflow-auto">
              <table className="w-full text-left text-[9px]">
                <thead className="sticky top-0 z-[1] bg-app-fill/95 text-app-muted">
                  <tr>
                    <th className="px-1 py-0.5">Phase</th>
                    <th className="px-1 py-0.5">Base</th>
                    <th className="px-1 py-0.5">Scaled</th>
                    <th className="px-1 py-0.5">Mods</th>
                    <th className="px-1 py-0.5">Eff.</th>
                    <th className="px-1 py-0.5">Start</th>
                    <th className="px-1 py-0.5">End</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((row, i) => (
                    <tr key={row.phase_id} className="border-t border-app-border/60">
                      <td className="max-w-[8rem] px-1 py-0.5 text-app-text">
                        {workingSteps[i]?.task ?? row.phase_id}
                      </td>
                      <td className="whitespace-nowrap px-1 py-0.5 font-mono">{row.baseline_days}</td>
                      <td className="whitespace-nowrap px-1 py-0.5 font-mono">{row.scaled_days}</td>
                      <td className="max-w-[10rem] px-1 py-0.5 text-[8px] text-app-muted">
                        {formatModifierDeltas(row.modifier_deltas)}
                      </td>
                      <td className="whitespace-nowrap px-1 py-0.5 font-mono">{row.effective_days}</td>
                      <td className="whitespace-nowrap px-1 py-0.5 font-mono">{workingSteps[i]?.start_date}</td>
                      <td className="whitespace-nowrap px-1 py-0.5 font-mono">{workingSteps[i]?.end_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {opdpBinderSteps && opdpBinderSteps.length > 0 && !computeError && !computeLoading ? (
        <div className="mt-2 rounded border border-app-border/80 bg-app-surface/40 p-2">
          {manualDirty ? (
            <p className="mb-2 rounded border border-amber-400/50 bg-amber-50/80 px-2 py-1 text-[9px] text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-50/95">
              Stale: OPDP track was computed from the last worker schedule before manual edits.
            </p>
          ) : null}
          <div className="border-b border-fuchsia-900/15 pb-1.5 dark:border-fuchsia-100/15">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-fuchsia-900 dark:text-fuchsia-100">
              OPDP binder (parallel track; anchor = last PRB review in this schedule)
            </span>
          </div>
          <div className="max-h-56 min-w-0 overflow-auto pt-1">
            <table className="w-full text-left text-[9px]">
              <thead className="sticky top-0 z-[1] bg-app-fill/95 text-app-muted">
                <tr>
                  <th className="px-1 py-0.5">Task</th>
                  <th className="px-1 py-0.5">Start</th>
                  <th className="px-1 py-0.5">End</th>
                  <th className="px-1 py-0.5">Note</th>
                </tr>
              </thead>
              <tbody>
                {opdpBinderSteps.map((s, i) => (
                  <tr key={`opdp-${i}-${s.task}`} className="border-t border-app-border/60">
                    <td className="max-w-[10rem] px-1 py-0.5 text-app-text">{s.task}</td>
                    <td className="whitespace-nowrap px-1 py-0.5 font-mono">{s.start_date}</td>
                    <td className="whitespace-nowrap px-1 py-0.5 font-mono">{s.end_date}</td>
                    <td className="max-w-[14rem] px-1 py-0.5 text-[8px] text-app-muted">{s.note ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {importErr ? (
        <p className="mt-2 text-[10px] text-rose-700 dark:text-rose-300">{importErr}</p>
      ) : null}

      {keyDateRows.length > 0 && !computeError && !computeLoading ? (
        <div className="mt-2">
          <TimelineKeyDatesView
            variant="scenario"
            rows={keyDateRows}
            title="Key dates"
            description={SCHEDULE_INTRO}
            detailColumnHeader="Details"
            calendarDragEdit={{ onShiftStepToDay: onCalendarShiftStepToDay }}
          />
        </div>
      ) : null}

      {workingSteps && workingSteps.length > 0 && !computeError && !computeLoading ? (
        <ScenarioEditableStepsTable
          steps={workingSteps}
          kickoffRefIso={workingSteps[0]?.start_date ?? anchorIso}
          holidaySet={holidaySet}
          onStepChange={onWorkingStepChange}
          onStepsReplace={onWorkingStepsReplace}
        />
      ) : null}
    </div>
  );
}
