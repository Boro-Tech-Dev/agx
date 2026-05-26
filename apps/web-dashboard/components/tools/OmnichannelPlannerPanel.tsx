'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  applyOmnichannelPlan,
  downloadProjectDocumentText,
  listProjectDocuments,
  listProjectTactics,
  listTacticsLibrary,
  uploadProjectDocument,
} from '../../lib/api';
import {
  createEmptyPlan,
  moveRow,
  normalizePlanOrders,
  parseUnknownPlan,
} from '../../lib/omnichannelPlanner/planModel';
import {
  resolveTimingProfileFromProjectTacticRow,
  resolveTimingProfileFromTacticLibraryRow,
} from '../../lib/scenarioPlanner/resolveTimingProfileFromTacticRow';
import type { ProjectHierarchyKeys } from '../../lib/tools/inferTimingProfileFromProject';
import type { OmnichannelPlan, OmnichannelPlanRow } from '../../lib/omnichannelPlanner/types';
import { useLearningMissionParams } from '../../lib/learning/useLearningMissionParams';
import { validateLearningAfterSave } from '../../lib/learning/validateAfterToolSave';
import { filterLibraryRowsForAttach, filterTacticsByQuery } from '../../lib/tacticLibraryFilter';
import { SCENARIO_TACTICS, scenarioTacticLabel, type ScenarioTactic } from '../../lib/scenarioPlanner/tactics';

function rowFromLibrary(
  lib: Record<string, unknown>,
  project: ProjectHierarchyKeys | null | undefined,
): OmnichannelPlanRow {
  const tp = resolveTimingProfileFromTacticLibraryRow(lib, project ?? null);
  return {
    id: crypto.randomUUID(),
    order: 0,
    tactic_library_id: String(lib.id),
    tactic_key: typeof lib.key === 'string' ? lib.key : undefined,
    label_snapshot: typeof lib.name === 'string' ? lib.name : undefined,
    timing_profile: tp ?? undefined,
    scenario_tactic: null,
    notes: '',
  };
}

function rowFromProjectTactic(
  pt: Record<string, unknown>,
  project: ProjectHierarchyKeys | null | undefined,
): OmnichannelPlanRow {
  const tp = resolveTimingProfileFromProjectTacticRow(pt, project ?? null);
  return {
    id: crypto.randomUUID(),
    order: 0,
    tactic_library_id: String(pt.tactic_id),
    tactic_key: typeof pt.tactic_key === 'string' ? pt.tactic_key : undefined,
    label_snapshot: typeof pt.tactic_name === 'string' ? pt.tactic_name : undefined,
    timing_profile: tp ?? undefined,
    scenario_tactic: null,
    notes: typeof pt.notes === 'string' ? pt.notes : '',
  };
}

export function OmnichannelPlannerPanel({
  projectKey,
  scenarioTactic,
  onScenarioTacticChange,
  projectCadenceContext = null,
}: {
  projectKey: string;
  scenarioTactic: ScenarioTactic;
  onScenarioTacticChange: (tactic: ScenarioTactic) => void;
  projectCadenceContext?: ProjectHierarchyKeys | null;
}) {
  const [plan, setPlan] = useState<OmnichannelPlan>(() => createEmptyPlan(''));
  const [libQuery, setLibQuery] = useState('');
  const [libAll, setLibAll] = useState<Record<string, unknown>[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const [projectHits, setProjectHits] = useState<Record<string, unknown>[]>([]);
  const [savedDocs, setSavedDocs] = useState<Record<string, unknown>[]>([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const mission = useLearningMissionParams();

  useEffect(() => {
    setPlan(createEmptyPlan(projectKey || ''));
    setSelectedDocId('');
    setMsg(null);
    setErr(null);
  }, [projectKey]);

  const reloadSavedDocs = useCallback(async () => {
    if (!projectKey.trim()) {
      setSavedDocs([]);
      return;
    }
    try {
      const rows = await listProjectDocuments(projectKey.trim(), { kinds: ['omnichannel_plan'] });
      setSavedDocs(Array.isArray(rows) ? rows : []);
    } catch {
      setSavedDocs([]);
    }
  }, [projectKey]);

  const reloadProjectTactics = useCallback(async () => {
    if (!projectKey.trim()) {
      setProjectHits([]);
      return;
    }
    try {
      const rows = await listProjectTactics(projectKey.trim());
      setProjectHits(Array.isArray(rows) ? rows : []);
    } catch {
      setProjectHits([]);
    }
  }, [projectKey]);

  useEffect(() => {
    void reloadSavedDocs();
    void reloadProjectTactics();
  }, [reloadSavedDocs, reloadProjectTactics]);

  const loadTacticsLibrary = useCallback(async () => {
    if (!projectKey.trim()) {
      setLibAll([]);
      return;
    }
    setLibLoading(true);
    setErr(null);
    try {
      const rows = await listTacticsLibrary();
      setLibAll(filterLibraryRowsForAttach(Array.isArray(rows) ? rows : []));
    } catch (e: unknown) {
      setLibAll([]);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLibLoading(false);
    }
  }, [projectKey]);

  useEffect(() => {
    void loadTacticsLibrary();
  }, [loadTacticsLibrary]);

  const libFiltered = useMemo(() => filterTacticsByQuery(libAll, libQuery), [libAll, libQuery]);

  const libEmpty = Boolean(projectKey.trim()) && !libLoading && libAll.length === 0;
  const libFilterEmpty =
    !libLoading && libAll.length > 0 && libFiltered.length === 0 && libQuery.trim() !== '';

  const addRow = useCallback((row: OmnichannelPlanRow) => {
    setPlan((p) => ({
      ...p,
      project_key: projectKey || p.project_key,
      rows: normalizePlanOrders([...p.rows, row]),
    }));
    setMsg(null);
  }, [projectKey]);

  const updateRow = useCallback((id: string, patch: Partial<OmnichannelPlanRow>) => {
    setPlan((p) => ({
      ...p,
      rows: normalizePlanOrders(p.rows.map((r) => (r.id === id ? { ...r, ...patch } : r))),
    }));
  }, []);

  const removeRow = useCallback((id: string) => {
    setPlan((p) => ({
      ...p,
      rows: normalizePlanOrders(p.rows.filter((r) => r.id !== id)),
    }));
  }, []);

  const onMove = useCallback((id: string, dir: -1 | 1) => {
    setPlan((p) => ({ ...p, rows: moveRow(p.rows, id, dir) }));
  }, []);

  const savePlanDoc = useCallback(async () => {
    if (!projectKey.trim()) return;
    setErr(null);
    setMsg(null);
    const body: OmnichannelPlan = {
      ...plan,
      project_key: projectKey.trim(),
      rows: normalizePlanOrders(plan.rows),
    };
    setBusy(true);
    try {
      const blob = new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' });
      const slug = new Date().toISOString().slice(0, 10);
      const file = new File([blob], `omnichannel-plan-${slug}-${Date.now()}.json`, { type: 'application/json' });
      await uploadProjectDocument(projectKey.trim(), file, 'omnichannel_plan');
      const validated = await validateLearningAfterSave(mission.enrollmentId, mission.stepId);
      setMsg(
        validated
          ? `Plan saved (omnichannel_plan). ${validated}`
          : 'Plan saved to project files (kind omnichannel_plan).',
      );
      await reloadSavedDocs();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [mission.enrollmentId, mission.stepId, plan, projectKey, reloadSavedDocs]);

  const loadSelectedDoc = useCallback(async () => {
    if (!projectKey.trim() || !selectedDocId) return;
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const text = await downloadProjectDocumentText(projectKey.trim(), selectedDocId);
      const raw = JSON.parse(text) as unknown;
      const parsed = parseUnknownPlan(raw, projectKey.trim());
      if (parsed.ok === false) {
        setErr(parsed.errors.join('; '));
        return;
      }
      setPlan(parsed.plan);
      setMsg('Loaded plan from project file.');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [projectKey, selectedDocId]);

  const syncProjectTactics = useCallback(async () => {
    if (!projectKey.trim()) return;
    setErr(null);
    setMsg(null);
    const body: OmnichannelPlan = {
      ...plan,
      project_key: projectKey.trim(),
      rows: normalizePlanOrders(plan.rows),
    };
    setBusy(true);
    try {
      const out = (await applyOmnichannelPlan(projectKey.trim(), body as unknown as Record<string, unknown>)) as {
        applied?: number;
      };
      setMsg(`Synced ${out.applied ?? 0} tactic link(s) to this project.`);
      await reloadProjectTactics();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [plan, projectKey, reloadProjectTactics]);

  const pushRowToScenario = useCallback(
    (row: OmnichannelPlanRow) => {
      setErr(null);
      const eff = row.timing_profile ?? row.scenario_tactic;
      if (!eff) {
        setErr('Choose a timing profile for this row before sending to Scenario Planner.');
        return;
      }
      onScenarioTacticChange(eff);
      setMsg(`Scenario Planner timing set to ${scenarioTacticLabel(eff)}.`);
    },
    [onScenarioTacticChange],
  );

  const rowsSorted = useMemo(() => normalizePlanOrders(plan.rows), [plan.rows]);

  const hintForLibraryDefaults = (row: OmnichannelPlanRow) => {
    const pt = projectHits.find((p) => String(p.tactic_id) === row.tactic_library_id);
    const off = pt?.default_start_offset_days;
    const dur = pt?.default_duration_days;
    if (off == null && dur == null) return null;
    const parts: string[] = [];
    if (typeof off === 'number') parts.push(`start offset ${off}d`);
    if (typeof dur === 'number') parts.push(`duration ${dur}d`);
    return parts.join(' · ');
  };

  return (
    <div className="rounded border border-app-border bg-app-fill/70 p-2">
      <p className="text-[10px] leading-snug text-app-muted">
        Build an ordered cross-channel mix from the tactics library (or tactics already on this project). Each row uses a{' '}
        <span className="font-medium text-app-text">timing profile</span> for delivery scheduling, then push to Scenario Planner below.
        Save loads as JSON project files (<code className="rounded bg-app-fill px-0.5">omnichannel_plan</code>).
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !projectKey.trim()}
          className="rounded-md border border-app-border bg-app-surface px-2 py-1 text-[10px] font-medium text-app-text hover:bg-app-fill-hover disabled:opacity-50"
          onClick={() => void savePlanDoc()}
        >
          Save plan to project
        </button>
        <button
          type="button"
          disabled={busy || !projectKey.trim() || plan.rows.length === 0}
          className="rounded-md border border-app-border bg-app-surface px-2 py-1 text-[10px] font-medium text-app-text hover:bg-app-fill-hover disabled:opacity-50"
          onClick={() => void syncProjectTactics()}
        >
          Sync to project tactics
        </button>
      </div>

      <div className="mt-3 grid gap-2 tablet:grid-cols-2">
        <div className="rounded border border-app-border/80 bg-app-surface/40 p-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Tactics library</div>
          <div className="mt-1 flex gap-1">
            <input
              value={libQuery}
              onChange={(e) => setLibQuery(e.target.value)}
              placeholder="Filter (name, key, channel)…"
              className="min-w-0 flex-1 rounded border border-app-border bg-app-fill px-2 py-1 text-[11px] text-app-text"
              disabled={!projectKey.trim()}
            />
            <button
              type="button"
              disabled={busy || libLoading || !projectKey.trim()}
              className="shrink-0 rounded border border-app-border bg-indigo-500/90 px-2 py-1 text-[10px] font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
              onClick={() => void loadTacticsLibrary()}
              title="Reload library from server"
            >
              Refresh
            </button>
          </div>
          {libLoading ? <div className="mt-1 text-[9px] text-app-muted">Loading library…</div> : null}
          {libEmpty ? (
            <div className="mt-1 text-[9px] text-app-muted">
              No active tactics in the database. Apply the tactic library seed migration or create tactics in Workspaces.
            </div>
          ) : null}
          {libFilterEmpty ? (
            <div className="mt-1 text-[9px] text-app-muted">No rows match this filter — clear the box to see all.</div>
          ) : null}
          <ul className="mt-2 max-h-32 overflow-auto text-[10px]">
            {libFiltered.map((lib) => (
              <li key={String(lib.id)} className="flex items-start justify-between gap-1 border-b border-app-border/50 py-1">
                <span className="min-w-0">
                  <span className="font-medium text-app-text">{String(lib.name ?? lib.key)}</span>
                  {lib.channel ? <span className="text-app-muted"> · {String(lib.channel)}</span> : null}
                </span>
                <button
                  type="button"
                  className="shrink-0 text-indigo-600 hover:underline dark:text-indigo-300"
                  onClick={() => addRow(rowFromLibrary(lib, projectCadenceContext))}
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded border border-app-border/80 bg-app-surface/40 p-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Project tactics</div>
          <ul className="mt-2 max-h-40 overflow-auto text-[10px]">
            {projectHits.map((pt) => (
              <li key={String(pt.id)} className="flex items-start justify-between gap-1 border-b border-app-border/50 py-1">
                <span className="min-w-0">
                  <span className="font-medium text-app-text">{String(pt.tactic_name ?? pt.tactic_key)}</span>
                  {pt.channel ? <span className="text-app-muted"> · {String(pt.channel)}</span> : null}
                </span>
                <button
                  type="button"
                  className="shrink-0 text-indigo-600 hover:underline dark:text-indigo-300"
                  onClick={() => addRow(rowFromProjectTactic(pt, projectCadenceContext))}
                >
                  Add
                </button>
              </li>
            ))}
            {projectHits.length === 0 ? (
              <li className="text-app-muted">None attached — add tactics on Workspaces or use library search.</li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="mt-3 overflow-auto rounded border border-app-border">
        <table className="w-full min-w-[640px] border-collapse text-left text-[10px]">
          <thead className="border-b border-app-border bg-app-fill/80 text-app-muted">
            <tr>
              <th className="px-2 py-1.5 font-semibold">#</th>
              <th className="px-2 py-1.5 font-semibold">Tactic</th>
              <th className="px-2 py-1.5 font-semibold">Timing profile</th>
              <th className="px-2 py-1.5 font-semibold">Notes</th>
              <th className="px-2 py-1.5 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rowsSorted.map((row, idx) => {
              const effectiveTiming = row.timing_profile ?? row.scenario_tactic;
              const highlighted = effectiveTiming != null && effectiveTiming === scenarioTactic;
              const hint = hintForLibraryDefaults(row);
              return (
                <tr
                  key={row.id}
                  className={
                    highlighted
                      ? 'bg-emerald-500/10 dark:bg-emerald-500/15'
                      : idx % 2 === 0
                        ? 'bg-app-surface/30'
                        : ''
                  }
                >
                  <td className="border-t border-app-border px-2 py-1 align-top text-app-muted">{idx + 1}</td>
                  <td className="border-t border-app-border px-2 py-1 align-top">
                    <div className="font-medium text-app-text">{row.label_snapshot || row.tactic_key || row.tactic_library_id}</div>
                    {hint ? <div className="text-[9px] text-app-muted">Library defaults: {hint}</div> : null}
                  </td>
                  <td className="border-t border-app-border px-2 py-1 align-top">
                    <select
                      value={effectiveTiming ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateRow(row.id, {
                          timing_profile: v === '' ? null : (v as ScenarioTactic),
                          scenario_tactic: null,
                        });
                      }}
                      className="w-full max-w-[11rem] rounded border border-app-border bg-app-surface p-1 text-[10px]"
                    >
                      <option value="">—</option>
                      {SCENARIO_TACTICS.map((t) => (
                        <option key={t} value={t}>
                          {scenarioTacticLabel(t)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border-t border-app-border px-2 py-1 align-top">
                    <input
                      value={row.notes ?? ''}
                      onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                      className="w-full min-w-[8rem] rounded border border-app-border bg-app-fill px-1 py-0.5 text-[10px]"
                      placeholder="Optional"
                    />
                  </td>
                  <td className="border-t border-app-border px-2 py-1 align-top">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="rounded border border-app-border bg-app-surface px-1 py-0.5 hover:bg-app-fill-hover"
                        onClick={() => onMove(row.id, -1)}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="rounded border border-app-border bg-app-surface px-1 py-0.5 hover:bg-app-fill-hover"
                        onClick={() => onMove(row.id, 1)}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="rounded border border-fuchsia-300 bg-fuchsia-50 px-1 py-0.5 text-fuchsia-900 hover:bg-fuchsia-100 dark:border-fuchsia-500/40 dark:bg-fuchsia-500/15 dark:text-fuchsia-100"
                        onClick={() => pushRowToScenario(row)}
                      >
                        Use for scenario
                      </button>
                      <button
                        type="button"
                        className="rounded border border-rose-200 px-1 py-0.5 text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-200"
                        onClick={() => removeRow(row.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rowsSorted.length === 0 ? (
          <div className="p-3 text-center text-[10px] text-app-muted">No rows yet — add from library or project tactics.</div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block min-w-[12rem] flex-1 text-[10px] font-medium text-app-muted">
          Load saved plan
          <select
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
            className="mt-0.5 w-full rounded-md border border-app-border bg-app-surface p-1.5 text-[11px] text-app-text"
          >
            <option value="">Select JSON…</option>
            {savedDocs.map((d) => (
              <option key={String(d.id)} value={String(d.id)}>
                {String(d.original_filename ?? d.title ?? d.id)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy || !selectedDocId || !projectKey.trim()}
          className="rounded-md border border-app-border bg-app-surface px-2 py-1 text-[10px] font-medium hover:bg-app-fill-hover disabled:opacity-50"
          onClick={() => void loadSelectedDoc()}
        >
          Load
        </button>
      </div>

      {msg ? (
        <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50/90 p-2 text-[10px] text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-100">
          {msg}
        </div>
      ) : null}
      {err ? (
        <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-[10px] text-rose-800 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100">
          {err}
        </div>
      ) : null}
    </div>
  );
}
