import type { HalTimelineStep } from '../../halScenario';
import { validateHalTimelineSteps } from '../../halScenario';
import { addCalendarDaysUTC, inclusiveCalendarDaySpan, parseIsoDateUTC } from '../dateCalendar';
import type { ScenarioComplexity } from '../complexity';
import {
  basicScaledDaysOverride,
  complexitySpanMultiplier,
  filterScenarioStepsForPrbRounds,
  prbRoundsForComplexity,
} from '../complexity';
import { CLIENT_REVIEW_SCENARIO_PHASE_IDS } from '../tacticDurations';
import {
  timingProfileIncludesOpdpBinder,
  timingProfileMultForPhase,
  usesSchematicMlrPrbCadence,
  usesHappyGuyWeekAlignedPrbCadence,
  usesSkillArtsTieredPrbCadence,
} from '../timingProfiles';
import type { ScenarioTactic } from '../tactics';
import { isPrbPhaseId } from '../phaseCatalog';
import type { HappyGuyPrbSubmitAnchorWeekday } from '../prbWeekdayAnchors';
import { resolvePrbAnchorDay } from '../prbWeekdayAnchors';
import { resolveSkillArtsPageCount, skillArtsTierInclusiveWorkingDays } from '../skillArtsTier';
import {
  addWorkingDaysUTC,
  inclusiveWorkingDaySpan,
  isWorkingDay,
  nextWorkingDay,
  previousWorkingDayOnOrBefore,
  type HolidaySet,
} from '../workingDays';
import { computeOpdpBinderSteps } from '../opdpBinderCompute';
import { getScenarioStepsOrdered } from './loadPlannerConfig';
import { mergeModifierPhaseNotes, REGISTERED_MODIFIER_BUNDLES } from './modifierBundles';
import type { LinearStepBreakdown, ScenarioStepDef } from './types';
import {
  happyGuyAdjustEffectiveForDevelopmentDevGap,
  happyGuyApplyPinnedPrefixPrbState,
  happyGuyTryPlaceWeekAlignedDevelopmentDevGapRow,
  happyGuyTryPlaceWeekAlignedPrbRow,
  maybeShiftHappyGuyClientShare,
  type HappyGuyPrbRefs,
} from './happyguy_strategy';
import {
  schematicMlrApplyPinnedPrefixPrbState,
  schematicMlrAdjustEffectiveForDevelopmentDevGap,
  schematicMlrTryPlaceDevelopmentDevGapRow,
  schematicMlrTryPlacePrbRow,
  type SchematicMlrPrbRefs,
} from './schematic_strategy';
import {
  skillArtsTryPlaceTieredPrbRow,
  type SkillArtsPrbRefs,
} from './skillarts_strategy';
import {
  LINEAR_EMPTY_HOLIDAYS,
  linearAllowNonWorkingFor as allowNonWorkingFor,
  linearClampDays as clampDays,
  linearMergeModifierDeltas as mergeModifierDeltas,
  linearPrbStepAllowNonWorking as prbStepAllowNonWorking,
  linearScaledBaseline as scaledBaseline,
  linearStepPayload as stepPayload,
  linearValidateIso as validateIso,
} from './scenario_linear_shared';

const EMPTY_HOLIDAYS = LINEAR_EMPTY_HOLIDAYS;

export type ComputeLinearScenarioParams = {
  anchorStartIso: string;
  /** Timing profile id (`config/scenario_planner/timing_profiles.json`). */
  timingProfile: ScenarioTactic;
  complexity?: ScenarioComplexity;
  /** Adds this many business days to each client-review-class phase (API name retained). */
  clientReviewExtraCalendarDays?: number;
  holidays?: HolidaySet;
  phaseAllowNonWorkingDays?: Readonly<Record<string, boolean>>;
  /** Stacking order: deltas summed in array order (Option A). */
  activeModifierIds?: readonly string[];
  /** Page count for `skillarts_tiered` profiles; defaults when omitted (see SCHEMA.md). */
  pageCount?: number;
  /**
   * When set with {@link pinnedPrefixSteps}, indices `0..freezeAfterStepIndex` use pinned dates/tasks;
   * later indices are computed forward from the pinned segment using normal placement rules.
   */
  freezeAfterStepIndex?: number;
  pinnedPrefixSteps?: readonly HalTimelineStep[];
  /** Tactic library catalog key; selects variant spines for shared timing profiles. */
  catalogTacticKey?: string;
};

export type ComputeLinearScenarioResult =
  | {
      ok: true;
      steps: HalTimelineStep[];
      breakdown: LinearStepBreakdown[];
      opdp_binder_steps?: HalTimelineStep[];
    }
  | { ok: false; error: string };

export function computeLinearScenarioSteps(p: ComputeLinearScenarioParams): ComputeLinearScenarioResult {
  const anchorErr = validateIso(p.anchorStartIso, 'Kickoff date');
  if (anchorErr) return { ok: false, error: anchorErr };

  const extra = p.clientReviewExtraCalendarDays ?? 0;
  if (extra < 0 || extra > 60) {
    return { ok: false, error: 'Client review extra days must be between 0 and 60.' };
  }

  const holidays = p.holidays ?? EMPTY_HOLIDAYS;
  const allowMap = p.phaseAllowNonWorkingDays;
  const complexity = p.complexity ?? 'medium';
  const activeModifierIds = p.activeModifierIds ?? [];

  for (const mid of activeModifierIds) {
    if (!REGISTERED_MODIFIER_BUNDLES[mid]) {
      return { ok: false, error: `Unknown modifier tactic: ${mid}` };
    }
  }

  const ordered = filterScenarioStepsForPrbRounds(
    getScenarioStepsOrdered(p.timingProfile, p.catalogTacticKey),
    prbRoundsForComplexity(complexity),
  );

  const fz = p.freezeAfterStepIndex;
  const pins = p.pinnedPrefixSteps;
  if ((fz === undefined) !== (pins === undefined)) {
    return { ok: false, error: 'freezeAfterStepIndex and pinnedPrefixSteps must be provided together.' };
  }
  if (fz !== undefined) {
    if (!Number.isInteger(fz) || fz < 0 || fz >= ordered.length) {
      return { ok: false, error: 'freezeAfterStepIndex out of range for this tactic spine.' };
    }
    if (!pins || pins.length !== fz + 1) {
      return { ok: false, error: 'pinnedPrefixSteps must have length freezeAfterStepIndex + 1.' };
    }
    const pinErr = validateHalTimelineSteps([...pins]);
    if (pinErr) return { ok: false, error: `pinnedPrefixSteps: ${pinErr}` };
    for (let j = 0; j < pins.length; j++) {
      if (pins[j]!.task.trim() !== ordered[j]!.label.trim()) {
        return {
          ok: false,
          error: `pinnedPrefixSteps[${j}].task must match spine label "${ordered[j]!.label}".`,
        };
      }
    }
  }

  try {
    let cursorCal = p.anchorStartIso;
    const steps: HalTimelineStep[] = [];
    const breakdown: LinearStepBreakdown[] = [];
    let emailPrb1SubmitMonday: string | null = null;
    let emailPrb1SubmitEnd: string | null = null;
    let emailPrb2SubmitMonday: string | null = null;
    let emailPrb2SubmitEnd: string | null = null;
    let emailPrb3SubmitMonday: string | null = null;
    let emailPrb3SubmitEnd: string | null = null;
    let skillArtsPrb1SubmitStart: string | null = null;
    let skillArtsPrb1SubmitEnd: string | null = null;
    let skillArtsPrb2SubmitStart: string | null = null;
    let skillArtsPrb2SubmitEnd: string | null = null;
    let skillArtsPrb3SubmitStart: string | null = null;
    let skillArtsPrb3SubmitEnd: string | null = null;
    let happyGuyPrb1SubmitStart: string | null = null;
    let happyGuyPrb1SubmitEnd: string | null = null;
    let happyGuyPrb2SubmitStart: string | null = null;
    let happyGuyPrb2SubmitEnd: string | null = null;
    let happyGuyPrb3SubmitStart: string | null = null;
    let happyGuyPrb3SubmitEnd: string | null = null;
    /** Per-round HappyGuy submit anchor chosen by proximity (drives matching review weekday). */
    let happyGuyPrb1AnchorWd: HappyGuyPrbSubmitAnchorWeekday | null = null;
    let happyGuyPrb2AnchorWd: HappyGuyPrbSubmitAnchorWeekday | null = null;
    let happyGuyPrb3AnchorWd: HappyGuyPrbSubmitAnchorWeekday | null = null;
    /** Last PRB review start in HappyGuy cadence (rounds depend on complexity); OPDP anchors here. */
    let happyGuyLastPrbReviewStartForOpdp: string | null = null;

    const skillArtsTierSpan = usesSkillArtsTieredPrbCadence(p.timingProfile)
      ? skillArtsTierInclusiveWorkingDays(resolveSkillArtsPageCount(p.pageCount))
      : 0;

    for (let stepIndex = 0; stepIndex < ordered.length; stepIndex++) {
      const row = ordered[stepIndex]!;
      const noteOut = mergeModifierPhaseNotes(row.id, row.note, activeModifierIds);
      const allow = allowNonWorkingFor(row.id, allowMap);
      let scaled = scaledBaseline(row, p.timingProfile, complexity);
      if (complexity === 'basic') {
        const fixed = basicScaledDaysOverride(row.id);
        if (fixed !== undefined) scaled = fixed;
      }
      const { sum: modSum, byId } = mergeModifierDeltas(row.id, activeModifierIds);
      let effective = clampDays(scaled + modSum, row);
      if (CLIENT_REVIEW_SCENARIO_PHASE_IDS.has(row.id)) {
        effective = clampDays(effective + extra, row);
      }

      const devPrbRow =
        row.id === 'development_prb1' || row.id === 'development_prb2' || row.id === 'development_prb3';

      const useSkillArtsTieredDevGap =
        usesSkillArtsTieredPrbCadence(p.timingProfile) && !allow && devPrbRow;

      const useEmailPrbDevGap =
        usesSchematicMlrPrbCadence(p.timingProfile) && !allow && devPrbRow;

      if (useSkillArtsTieredDevGap) {
        let submitAnchor: string | null = null;
        let submitEnd: string | null = null;
        let reviewPhaseId: 'prb1_review' | 'prb2_review' | 'prb3_review';
        let errEarly: string | null = null;
        if (row.id === 'development_prb1') {
          submitAnchor = skillArtsPrb1SubmitStart;
          submitEnd = skillArtsPrb1SubmitEnd;
          reviewPhaseId = 'prb1_review';
          errEarly = 'PRB1 development scheduled before PRB1 submit (internal error).';
        } else if (row.id === 'development_prb2') {
          submitAnchor = skillArtsPrb2SubmitStart;
          submitEnd = skillArtsPrb2SubmitEnd;
          reviewPhaseId = 'prb2_review';
          errEarly = 'PRB2 development scheduled before PRB2 submit (internal error).';
        } else {
          submitAnchor = skillArtsPrb3SubmitStart;
          submitEnd = skillArtsPrb3SubmitEnd;
          reviewPhaseId = 'prb3_review';
          errEarly = 'PRB3 development scheduled before PRB3 submit (internal error).';
        }
        if (!submitAnchor || !submitEnd) {
          return { ok: false, error: errEarly };
        }
        const idealReview = addWorkingDaysUTC(submitAnchor, skillArtsTierSpan - 1, holidays);
        const reviewAllow = allowNonWorkingFor(reviewPhaseId, allowMap);
        const reviewResolved = resolvePrbAnchorDay(idealReview, holidays, reviewAllow);
        let gapStart = nextWorkingDay(addCalendarDaysUTC(submitEnd, 1), holidays);
        const gapEnd = previousWorkingDayOnOrBefore(
          addCalendarDaysUTC(reviewResolved.iso, -1),
          holidays,
        );
        if (parseIsoDateUTC(gapStart).getTime() > parseIsoDateUTC(gapEnd).getTime()) {
          gapStart = gapEnd;
        }
        const rawSpan = Math.max(1, inclusiveWorkingDaySpan(gapStart, gapEnd, holidays));
        const bumped = clampDays(rawSpan + modSum, row);
        effective = Math.min(bumped, rawSpan);
      }

      if (useEmailPrbDevGap) {
        const mlrRefsEarly: SchematicMlrPrbRefs = {
          emailPrb1SubmitMonday,
          emailPrb1SubmitEnd,
          emailPrb2SubmitMonday,
          emailPrb2SubmitEnd,
          emailPrb3SubmitMonday,
          emailPrb3SubmitEnd,
        };
        const mlrEff = schematicMlrAdjustEffectiveForDevelopmentDevGap(
          p.timingProfile,
          allow,
          row,
          holidays,
          allowMap,
          modSum,
          effective,
          mlrRefsEarly,
        );
        if (typeof mlrEff !== 'number') return mlrEff;
        effective = mlrEff;
      }

      const useHappyGuyWeekAlignedDevGap =
        usesHappyGuyWeekAlignedPrbCadence(p.timingProfile) && !allow && devPrbRow;

      if (useHappyGuyWeekAlignedDevGap) {
        const hgRefsEarly: HappyGuyPrbRefs = {
          happyGuyPrb1SubmitStart,
          happyGuyPrb1SubmitEnd,
          happyGuyPrb2SubmitStart,
          happyGuyPrb2SubmitEnd,
          happyGuyPrb3SubmitStart,
          happyGuyPrb3SubmitEnd,
          happyGuyPrb1AnchorWd,
          happyGuyPrb2AnchorWd,
          happyGuyPrb3AnchorWd,
          happyGuyLastPrbReviewStartForOpdp,
        };
        const hgEff = happyGuyAdjustEffectiveForDevelopmentDevGap(
          p.timingProfile,
          allow,
          row,
          holidays,
          allowMap,
          modSum,
          effective,
          hgRefsEarly,
        );
        if (typeof hgEff !== 'number') return hgEff;
        effective = hgEff;
      }

      effective = Math.max(1, effective);

      let effectiveForBreakdown = effective;
      if (fz !== undefined && pins && stepIndex <= fz) {
        const pin = pins[stepIndex]!;
        const pinAllow = pin.allow_non_working_days === true || allow;
        effectiveForBreakdown = pinAllow
          ? Math.max(1, inclusiveCalendarDaySpan(pin.start_date, pin.end_date))
          : Math.max(1, inclusiveWorkingDaySpan(pin.start_date, pin.end_date, holidays) || 1);
      }

      breakdown.push({
        phase_id: row.id,
        baseline_days: row.baseline_days,
        scaled_days: scaled,
        modifier_deltas: byId,
        effective_days: effectiveForBreakdown,
      });

      if (fz !== undefined && pins && stepIndex <= fz) {
        const pin = pins[stepIndex]!;
        const outStep: HalTimelineStep = {
          task: row.label,
          start_date: pin.start_date,
          end_date: pin.end_date,
          note: pin.note != null && String(pin.note).trim() !== '' ? pin.note : noteOut,
        };
        if (pin.allow_non_working_days === true) outStep.allow_non_working_days = true;
        steps.push(outStep);

        const prbCadenceRow =
          row.id === 'submit_prb1' ||
          row.id === 'prb1_review' ||
          row.id === 'submit_prb2' ||
          row.id === 'prb2_review' ||
          row.id === 'submit_prb3' ||
          row.id === 'prb3_review';

        if (usesSchematicMlrPrbCadence(p.timingProfile) && !allow && prbCadenceRow) {
          const mlrRefsPin: SchematicMlrPrbRefs = {
            emailPrb1SubmitMonday,
            emailPrb1SubmitEnd,
            emailPrb2SubmitMonday,
            emailPrb2SubmitEnd,
            emailPrb3SubmitMonday,
            emailPrb3SubmitEnd,
          };
          schematicMlrApplyPinnedPrefixPrbState(p.timingProfile, allow, row, pin, mlrRefsPin);
          emailPrb1SubmitMonday = mlrRefsPin.emailPrb1SubmitMonday;
          emailPrb1SubmitEnd = mlrRefsPin.emailPrb1SubmitEnd;
          emailPrb2SubmitMonday = mlrRefsPin.emailPrb2SubmitMonday;
          emailPrb2SubmitEnd = mlrRefsPin.emailPrb2SubmitEnd;
          emailPrb3SubmitMonday = mlrRefsPin.emailPrb3SubmitMonday;
          emailPrb3SubmitEnd = mlrRefsPin.emailPrb3SubmitEnd;
        }

        if (usesSkillArtsTieredPrbCadence(p.timingProfile) && !allow && prbCadenceRow) {
          if (row.id === 'submit_prb1') {
            skillArtsPrb1SubmitStart = pin.start_date;
            skillArtsPrb1SubmitEnd = pin.end_date;
          } else if (row.id === 'submit_prb2') {
            skillArtsPrb2SubmitStart = pin.start_date;
            skillArtsPrb2SubmitEnd = pin.end_date;
          } else if (row.id === 'submit_prb3') {
            skillArtsPrb3SubmitStart = pin.start_date;
            skillArtsPrb3SubmitEnd = pin.end_date;
          }
        }

        if (usesHappyGuyWeekAlignedPrbCadence(p.timingProfile) && !allow && prbCadenceRow) {
          const hgRefsPin: HappyGuyPrbRefs = {
            happyGuyPrb1SubmitStart,
            happyGuyPrb1SubmitEnd,
            happyGuyPrb2SubmitStart,
            happyGuyPrb2SubmitEnd,
            happyGuyPrb3SubmitStart,
            happyGuyPrb3SubmitEnd,
            happyGuyPrb1AnchorWd,
            happyGuyPrb2AnchorWd,
            happyGuyPrb3AnchorWd,
            happyGuyLastPrbReviewStartForOpdp,
          };
          happyGuyApplyPinnedPrefixPrbState(
            p.timingProfile,
            allow,
            row,
            pin,
            cursorCal,
            holidays,
            hgRefsPin,
          );
          happyGuyPrb1SubmitStart = hgRefsPin.happyGuyPrb1SubmitStart;
          happyGuyPrb1SubmitEnd = hgRefsPin.happyGuyPrb1SubmitEnd;
          happyGuyPrb2SubmitStart = hgRefsPin.happyGuyPrb2SubmitStart;
          happyGuyPrb2SubmitEnd = hgRefsPin.happyGuyPrb2SubmitEnd;
          happyGuyPrb3SubmitStart = hgRefsPin.happyGuyPrb3SubmitStart;
          happyGuyPrb3SubmitEnd = hgRefsPin.happyGuyPrb3SubmitEnd;
          happyGuyPrb1AnchorWd = hgRefsPin.happyGuyPrb1AnchorWd;
          happyGuyPrb2AnchorWd = hgRefsPin.happyGuyPrb2AnchorWd;
          happyGuyPrb3AnchorWd = hgRefsPin.happyGuyPrb3AnchorWd;
          happyGuyLastPrbReviewStartForOpdp = hgRefsPin.happyGuyLastPrbReviewStartForOpdp;
        }

        cursorCal = addCalendarDaysUTC(pin.end_date, 1);
        continue;
      }

      const mlrRefsPlace: SchematicMlrPrbRefs = {
        emailPrb1SubmitMonday,
        emailPrb1SubmitEnd,
        emailPrb2SubmitMonday,
        emailPrb2SubmitEnd,
        emailPrb3SubmitMonday,
        emailPrb3SubmitEnd,
      };
      const mlrPlace = schematicMlrTryPlacePrbRow(
        p.timingProfile,
        allow,
        row,
        cursorCal,
        holidays,
        allowMap,
        effective,
        noteOut,
        mlrRefsPlace,
        steps,
      );
      // Error variant is the only branch with `ok` (narrows union for TS).
      if ('ok' in mlrPlace) return mlrPlace;
      if (mlrPlace.placed) {
        emailPrb1SubmitMonday = mlrRefsPlace.emailPrb1SubmitMonday;
        emailPrb1SubmitEnd = mlrRefsPlace.emailPrb1SubmitEnd;
        emailPrb2SubmitMonday = mlrRefsPlace.emailPrb2SubmitMonday;
        emailPrb2SubmitEnd = mlrRefsPlace.emailPrb2SubmitEnd;
        emailPrb3SubmitMonday = mlrRefsPlace.emailPrb3SubmitMonday;
        emailPrb3SubmitEnd = mlrRefsPlace.emailPrb3SubmitEnd;
        cursorCal = mlrPlace.nextCursorCal;
        continue;
      }

      const saRefsPlace: SkillArtsPrbRefs = {
        skillArtsPrb1SubmitStart,
        skillArtsPrb1SubmitEnd,
        skillArtsPrb2SubmitStart,
        skillArtsPrb2SubmitEnd,
        skillArtsPrb3SubmitStart,
        skillArtsPrb3SubmitEnd,
      };
      const saPlace = skillArtsTryPlaceTieredPrbRow(
        p.timingProfile,
        allow,
        row,
        cursorCal,
        holidays,
        allowMap,
        effective,
        noteOut,
        skillArtsTierSpan,
        saRefsPlace,
        steps,
      );
      if ('ok' in saPlace) return saPlace;
      if (saPlace.placed) {
        skillArtsPrb1SubmitStart = saRefsPlace.skillArtsPrb1SubmitStart;
        skillArtsPrb1SubmitEnd = saRefsPlace.skillArtsPrb1SubmitEnd;
        skillArtsPrb2SubmitStart = saRefsPlace.skillArtsPrb2SubmitStart;
        skillArtsPrb2SubmitEnd = saRefsPlace.skillArtsPrb2SubmitEnd;
        skillArtsPrb3SubmitStart = saRefsPlace.skillArtsPrb3SubmitStart;
        skillArtsPrb3SubmitEnd = saRefsPlace.skillArtsPrb3SubmitEnd;
        cursorCal = saPlace.nextCursorCal;
        continue;
      }

      const hgRefsPlace: HappyGuyPrbRefs = {
        happyGuyPrb1SubmitStart,
        happyGuyPrb1SubmitEnd,
        happyGuyPrb2SubmitStart,
        happyGuyPrb2SubmitEnd,
        happyGuyPrb3SubmitStart,
        happyGuyPrb3SubmitEnd,
        happyGuyPrb1AnchorWd,
        happyGuyPrb2AnchorWd,
        happyGuyPrb3AnchorWd,
        happyGuyLastPrbReviewStartForOpdp,
      };
      const hgPlace = happyGuyTryPlaceWeekAlignedPrbRow(
        p.timingProfile,
        allow,
        row,
        cursorCal,
        holidays,
        allowMap,
        effective,
        noteOut,
        hgRefsPlace,
        steps,
      );
      if ('ok' in hgPlace) return hgPlace;
      if (hgPlace.placed) {
        happyGuyPrb1SubmitStart = hgRefsPlace.happyGuyPrb1SubmitStart;
        happyGuyPrb1SubmitEnd = hgRefsPlace.happyGuyPrb1SubmitEnd;
        happyGuyPrb2SubmitStart = hgRefsPlace.happyGuyPrb2SubmitStart;
        happyGuyPrb2SubmitEnd = hgRefsPlace.happyGuyPrb2SubmitEnd;
        happyGuyPrb3SubmitStart = hgRefsPlace.happyGuyPrb3SubmitStart;
        happyGuyPrb3SubmitEnd = hgRefsPlace.happyGuyPrb3SubmitEnd;
        happyGuyPrb1AnchorWd = hgRefsPlace.happyGuyPrb1AnchorWd;
        happyGuyPrb2AnchorWd = hgRefsPlace.happyGuyPrb2AnchorWd;
        happyGuyPrb3AnchorWd = hgRefsPlace.happyGuyPrb3AnchorWd;
        happyGuyLastPrbReviewStartForOpdp = hgRefsPlace.happyGuyLastPrbReviewStartForOpdp;
        cursorCal = hgPlace.nextCursorCal;
        continue;
      }

      if (useSkillArtsTieredDevGap) {
        const submitAnchor =
          row.id === 'development_prb1'
            ? skillArtsPrb1SubmitStart!
            : row.id === 'development_prb2'
              ? skillArtsPrb2SubmitStart!
              : skillArtsPrb3SubmitStart!;
        const submitEnd =
          row.id === 'development_prb1'
            ? skillArtsPrb1SubmitEnd!
            : row.id === 'development_prb2'
              ? skillArtsPrb2SubmitEnd!
              : skillArtsPrb3SubmitEnd!;
        const reviewPhaseId =
          row.id === 'development_prb1'
            ? 'prb1_review'
            : row.id === 'development_prb2'
              ? 'prb2_review'
              : 'prb3_review';
        const idealReview = addWorkingDaysUTC(submitAnchor, skillArtsTierSpan - 1, holidays);
        const reviewResolved = resolvePrbAnchorDay(
          idealReview,
          holidays,
          allowNonWorkingFor(reviewPhaseId, allowMap),
        );
        let gapStart = nextWorkingDay(addCalendarDaysUTC(submitEnd, 1), holidays);
        const gapEnd = previousWorkingDayOnOrBefore(
          addCalendarDaysUTC(reviewResolved.iso, -1),
          holidays,
        );
        if (parseIsoDateUTC(gapStart).getTime() > parseIsoDateUTC(gapEnd).getTime()) {
          gapStart = gapEnd;
        }
        const start = gapStart;
        const end = addWorkingDaysUTC(start, effective - 1, holidays);
        steps.push(stepPayload(row.label, start, end, noteOut, false));
        cursorCal = addCalendarDaysUTC(end, 1);
        continue;
      }

      const mlrRefsDevGap: SchematicMlrPrbRefs = {
        emailPrb1SubmitMonday,
        emailPrb1SubmitEnd,
        emailPrb2SubmitMonday,
        emailPrb2SubmitEnd,
        emailPrb3SubmitMonday,
        emailPrb3SubmitEnd,
      };
      const mlrDevGap = schematicMlrTryPlaceDevelopmentDevGapRow(
        p.timingProfile,
        allow,
        row,
        holidays,
        allowMap,
        effective,
        noteOut,
        mlrRefsDevGap,
        steps,
      );
      if (mlrDevGap.placed) {
        cursorCal = mlrDevGap.nextCursorCal;
        continue;
      }

      const hgRefsDevGap: HappyGuyPrbRefs = {
        happyGuyPrb1SubmitStart,
        happyGuyPrb1SubmitEnd,
        happyGuyPrb2SubmitStart,
        happyGuyPrb2SubmitEnd,
        happyGuyPrb3SubmitStart,
        happyGuyPrb3SubmitEnd,
        happyGuyPrb1AnchorWd,
        happyGuyPrb2AnchorWd,
        happyGuyPrb3AnchorWd,
        happyGuyLastPrbReviewStartForOpdp,
      };
      const hgDevGap = happyGuyTryPlaceWeekAlignedDevelopmentDevGapRow(
        p.timingProfile,
        allow,
        row,
        holidays,
        allowMap,
        effective,
        noteOut,
        hgRefsDevGap,
        steps,
      );
      if ('ok' in hgDevGap) return hgDevGap;
      if (hgDevGap.placed) {
        cursorCal = hgDevGap.nextCursorCal;
        continue;
      }

      if (allow) {
        const start0 = cursorCal;
        const end0 = addCalendarDaysUTC(start0, effective - 1);
        const { start, end } = maybeShiftHappyGuyClientShare(p.timingProfile, row.id, start0, end0, holidays);
        steps.push(stepPayload(row.label, start, end, noteOut, true));
        cursorCal = addCalendarDaysUTC(end, 1);
      } else {
        const start0 = nextWorkingDay(cursorCal, holidays);
        const end0 = addWorkingDaysUTC(start0, effective - 1, holidays);
        const { start, end } = maybeShiftHappyGuyClientShare(p.timingProfile, row.id, start0, end0, holidays);
        steps.push(stepPayload(row.label, start, end, noteOut, false));
        cursorCal = addCalendarDaysUTC(end, 1);
      }
    }

    let opdpOut: HalTimelineStep[] | undefined;
    if (timingProfileIncludesOpdpBinder(p.timingProfile) && happyGuyLastPrbReviewStartForOpdp) {
      opdpOut = computeOpdpBinderSteps({
        anchorStartIso: happyGuyLastPrbReviewStartForOpdp,
        holidays: p.holidays,
      });
    }

    return opdpOut?.length
      ? { ok: true, steps, breakdown, opdp_binder_steps: opdpOut }
      : { ok: true, steps, breakdown };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
