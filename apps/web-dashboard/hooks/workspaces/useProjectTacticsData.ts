'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  attachProjectTactic,
  deleteProjectTactic,
  listProjectTactics,
  listTacticsLibrary,
  patchProjectTactic,
  patchTacticLibrary,
} from '../../lib/api';
import { filterLibraryRowsForAttach, filterTacticsByQuery } from '../../lib/tacticLibraryFilter';
import { parseJsonField, toTags } from '../../lib/workspaces/jsonHelpers';

export type ProjectTacticsDeps = {
  selectedKey: string;
  setMsg: (s: string) => void;
  setErr: (s: string) => void;
};

export function useProjectTacticsData(deps: ProjectTacticsDeps) {
  const { selectedKey, setMsg, setErr } = deps;

  const [tactics, setTactics] = useState<any[]>([]);
  const [tacticSearch, setTacticSearch] = useState('');
  const [tacticLibraryAll, setTacticLibraryAll] = useState<Record<string, unknown>[]>([]);
  const [tacticLibraryLoading, setTacticLibraryLoading] = useState(false);
  const [tacticAttachId, setTacticAttachId] = useState('');
  const [tacticNewKey, setTacticNewKey] = useState('');
  const [tacticNewName, setTacticNewName] = useState('');

  const [tacticLifecycleStatus, setTacticLifecycleStatus] = useState<
    'draft' | 'active' | 'paused' | 'completed' | 'archived'
  >('draft');
  const [tacticPriority, setTacticPriority] = useState('medium');
  const [tacticStartAt, setTacticStartAt] = useState('');
  const [tacticEndAt, setTacticEndAt] = useState('');
  const [tacticObjective, setTacticObjective] = useState('');
  const [tacticNotes, setTacticNotes] = useState('');
  const [tacticSuccessMetricsJson, setTacticSuccessMetricsJson] = useState('{}');
  const [tacticDependenciesJson, setTacticDependenciesJson] = useState('{}');
  const [tacticProjectMetadataJson, setTacticProjectMetadataJson] = useState('{}');

  const [tacticLibDescription, setTacticLibDescription] = useState('');
  const [tacticLibKind, setTacticLibKind] = useState('');
  const [tacticLibChannel, setTacticLibChannel] = useState('');
  const [tacticLibMedium, setTacticLibMedium] = useState('');
  const [tacticLibFormat, setTacticLibFormat] = useState('');
  const [tacticLibTagsCsv, setTacticLibTagsCsv] = useState('');
  const [tacticLibDefaultSuccessJson, setTacticLibDefaultSuccessJson] = useState('{}');
  const [tacticLibDefaultDepsJson, setTacticLibDefaultDepsJson] = useState('{}');
  const [tacticLibDefaultStartOffsetDays, setTacticLibDefaultStartOffsetDays] = useState('');
  const [tacticLibDefaultDurationDays, setTacticLibDefaultDurationDays] = useState('');
  const [tacticLibCadence, setTacticLibCadence] = useState('');
  const [tacticLibEstimatedCostCents, setTacticLibEstimatedCostCents] = useState('');
  const [tacticLibCurrency, setTacticLibCurrency] = useState('');
  const [tacticLibOwner, setTacticLibOwner] = useState('');
  const [tacticLibStatus, setTacticLibStatus] = useState<'draft' | 'active' | 'archived'>('active');
  const [tacticLibMetadataJson, setTacticLibMetadataJson] = useState('{}');

  const [tacticEditId, setTacticEditId] = useState<string | null>(null);
  const [tacticEditLibName, setTacticEditLibName] = useState('');
  const [tacticEditLibDescription, setTacticEditLibDescription] = useState('');
  const [tacticEditLibKind, setTacticEditLibKind] = useState('');
  const [tacticEditLibChannel, setTacticEditLibChannel] = useState('');
  const [tacticEditLibMedium, setTacticEditLibMedium] = useState('');
  const [tacticEditLibFormat, setTacticEditLibFormat] = useState('');
  const [tacticEditLibTagsCsv, setTacticEditLibTagsCsv] = useState('');
  const [tacticEditLibDefaultSuccessJson, setTacticEditLibDefaultSuccessJson] = useState('{}');
  const [tacticEditLibDefaultDepsJson, setTacticEditLibDefaultDepsJson] = useState('{}');
  const [tacticEditLibCadence, setTacticEditLibCadence] = useState('');
  const [tacticEditLibEstimatedCostCents, setTacticEditLibEstimatedCostCents] = useState('');
  const [tacticEditLibCurrency, setTacticEditLibCurrency] = useState('');
  const [tacticEditLibOwner, setTacticEditLibOwner] = useState('');
  const [tacticEditLibStatus, setTacticEditLibStatus] = useState<'draft' | 'active' | 'archived'>('active');
  const [tacticEditLibMetadataJson, setTacticEditLibMetadataJson] = useState('{}');

  const [tacticEditLifecycleStatus, setTacticEditLifecycleStatus] = useState<
    'draft' | 'active' | 'paused' | 'completed' | 'archived'
  >('draft');
  const [tacticEditPriority, setTacticEditPriority] = useState('medium');
  const [tacticEditStartAt, setTacticEditStartAt] = useState('');
  const [tacticEditEndAt, setTacticEditEndAt] = useState('');
  const [tacticEditObjectiveOverride, setTacticEditObjectiveOverride] = useState('');
  const [tacticEditNotes, setTacticEditNotes] = useState('');
  const [tacticEditSuccessMetricsJson, setTacticEditSuccessMetricsJson] = useState('{}');
  const [tacticEditDependenciesJson, setTacticEditDependenciesJson] = useState('{}');
  const [tacticEditProjectMetadataJson, setTacticEditProjectMetadataJson] = useState('{}');

  const loadTactics = useCallback(async (key: string) => {
    if (!key) {
      setTactics([]);
      return;
    }
    try {
      const rows = await listProjectTactics(key);
      setTactics(rows);
    } catch (e: unknown) {
      setTactics([]);
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [setErr]);

  const loadTacticLibraryAll = useCallback(async () => {
    if (!selectedKey) {
      setTacticLibraryAll([]);
      return;
    }
    setTacticLibraryLoading(true);
    try {
      const rows = await listTacticsLibrary();
      setTacticLibraryAll(filterLibraryRowsForAttach(Array.isArray(rows) ? rows : []));
    } catch (e: unknown) {
      setTacticLibraryAll([]);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setTacticLibraryLoading(false);
    }
  }, [selectedKey, setErr]);

  useEffect(() => {
    if (!selectedKey) {
      setTacticLibraryAll([]);
      return;
    }
    void loadTacticLibraryAll();
  }, [selectedKey, loadTacticLibraryAll]);

  const tacticSearchRows = useMemo(
    () => filterTacticsByQuery(tacticLibraryAll, tacticSearch),
    [tacticLibraryAll, tacticSearch],
  );

  const tacticLibraryIsEmpty =
    Boolean(selectedKey) && !tacticLibraryLoading && tacticLibraryAll.length === 0;
  const tacticLibraryFilterEmpty =
    !tacticLibraryLoading &&
    tacticLibraryAll.length > 0 &&
    tacticSearchRows.length === 0 &&
    tacticSearch.trim() !== '';

  /** Refetch full active library from API (e.g. after creating a new library tactic). */
  const loadTacticLibrarySearch = useCallback(async () => {
    await loadTacticLibraryAll();
  }, [loadTacticLibraryAll]);

  const onAttachExistingTactic = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!selectedKey) return;
      setMsg('');
      setErr('');
      try {
        if (!tacticAttachId) {
          setErr('Pick a tactic from the library list first.');
          return;
        }
        const sm = parseJsonField<Record<string, unknown>>('Success metrics override', tacticSuccessMetricsJson, {});
        if (sm.ok === false) {
          setErr(sm.error);
          return;
        }
        const depsJson = parseJsonField<Record<string, unknown>>('Dependencies override', tacticDependenciesJson, {});
        if (depsJson.ok === false) {
          setErr(depsJson.error);
          return;
        }
        const md = parseJsonField<Record<string, unknown>>('Project metadata', tacticProjectMetadataJson, {});
        if (md.ok === false) {
          setErr(md.error);
          return;
        }
        await attachProjectTactic(selectedKey, {
          tactic_id: tacticAttachId,
          lifecycle_status: tacticLifecycleStatus,
          priority: tacticPriority.trim() || undefined,
          start_at: tacticStartAt.trim() || undefined,
          end_at: tacticEndAt.trim() || undefined,
          objective_override: tacticObjective.trim() || undefined,
          notes: tacticNotes.trim() || undefined,
          success_metrics_override: sm.value,
          dependencies_override: depsJson.value,
          metadata: md.value,
        });
        setMsg('Attached tactic.');
        setTacticAttachId('');
        setTacticObjective('');
        setTacticNotes('');
        await loadTactics(selectedKey);
        await loadTacticLibraryAll();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [
      selectedKey,
      tacticAttachId,
      tacticLifecycleStatus,
      tacticPriority,
      tacticStartAt,
      tacticEndAt,
      tacticObjective,
      tacticNotes,
      tacticSuccessMetricsJson,
      tacticDependenciesJson,
      tacticProjectMetadataJson,
      loadTactics,
      loadTacticLibraryAll,
      setMsg,
      setErr,
    ],
  );

  const onCreateAndAttachNewTactic = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!selectedKey) return;
      setMsg('');
      setErr('');
      const key = tacticNewKey.trim().toLowerCase();
      const name = tacticNewName.trim();
      if (!key || !name) {
        setErr('Provide tactic key and name.');
        return;
      }
      try {
        const defSm = parseJsonField<Record<string, unknown>>('Default success metrics', tacticLibDefaultSuccessJson, {});
        if (defSm.ok === false) {
          setErr(defSm.error);
          return;
        }
        const defDeps = parseJsonField<Record<string, unknown>>('Default dependencies', tacticLibDefaultDepsJson, {});
        if (defDeps.ok === false) {
          setErr(defDeps.error);
          return;
        }
        const libMd = parseJsonField<Record<string, unknown>>('Library metadata', tacticLibMetadataJson, {});
        if (libMd.ok === false) {
          setErr(libMd.error);
          return;
        }
        const sm = parseJsonField<Record<string, unknown>>('Success metrics override', tacticSuccessMetricsJson, {});
        if (sm.ok === false) {
          setErr(sm.error);
          return;
        }
        const depsJson = parseJsonField<Record<string, unknown>>('Dependencies override', tacticDependenciesJson, {});
        if (depsJson.ok === false) {
          setErr(depsJson.error);
          return;
        }
        const projMd = parseJsonField<Record<string, unknown>>('Project metadata', tacticProjectMetadataJson, {});
        if (projMd.ok === false) {
          setErr(projMd.error);
          return;
        }
        const startOffset = tacticLibDefaultStartOffsetDays.trim();
        const duration = tacticLibDefaultDurationDays.trim();
        const cost = tacticLibEstimatedCostCents.trim();
        await attachProjectTactic(selectedKey, {
          tactic: {
            key,
            name,
            description: tacticLibDescription.trim() || undefined,
            tactic_kind: tacticLibKind.trim() || undefined,
            channel: tacticLibChannel.trim() || undefined,
            medium: tacticLibMedium.trim() || undefined,
            format: tacticLibFormat.trim() || undefined,
            tags: toTags(tacticLibTagsCsv),
            default_success_metrics: defSm.value,
            default_dependencies: defDeps.value,
            default_start_offset_days: startOffset ? Number(startOffset) : undefined,
            default_duration_days: duration ? Number(duration) : undefined,
            cadence: tacticLibCadence.trim() || undefined,
            estimated_cost_cents: cost ? Number(cost) : undefined,
            currency: tacticLibCurrency.trim() || undefined,
            owner: tacticLibOwner.trim() || undefined,
            status: tacticLibStatus,
            metadata: libMd.value,
          },
          lifecycle_status: tacticLifecycleStatus,
          priority: tacticPriority.trim() || undefined,
          start_at: tacticStartAt.trim() || undefined,
          end_at: tacticEndAt.trim() || undefined,
          objective_override: tacticObjective.trim() || undefined,
          notes: tacticNotes.trim() || undefined,
          success_metrics_override: sm.value,
          dependencies_override: depsJson.value,
          metadata: projMd.value,
        });
        setMsg('Created and attached tactic.');
        setTacticNewKey('');
        setTacticNewName('');
        setTacticObjective('');
        setTacticNotes('');
        setTacticSearch('');
        setTacticAttachId('');
        await loadTactics(selectedKey);
        await loadTacticLibraryAll();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [
      selectedKey,
      tacticNewKey,
      tacticNewName,
      tacticLibDescription,
      tacticLibKind,
      tacticLibChannel,
      tacticLibMedium,
      tacticLibFormat,
      tacticLibTagsCsv,
      tacticLibDefaultSuccessJson,
      tacticLibDefaultDepsJson,
      tacticLibDefaultStartOffsetDays,
      tacticLibDefaultDurationDays,
      tacticLibCadence,
      tacticLibEstimatedCostCents,
      tacticLibCurrency,
      tacticLibOwner,
      tacticLibStatus,
      tacticLibMetadataJson,
      tacticLifecycleStatus,
      tacticPriority,
      tacticStartAt,
      tacticEndAt,
      tacticObjective,
      tacticNotes,
      tacticSuccessMetricsJson,
      tacticDependenciesJson,
      tacticProjectMetadataJson,
      loadTactics,
      loadTacticLibraryAll,
      setMsg,
      setErr,
    ],
  );

  const openEditTacticRow = useCallback((t: any) => {
    setErr('');
    setMsg('');
    setTacticEditId(String(t.id));
    setTacticEditLibName(String(t.tactic_name || t.name || ''));
    setTacticEditLibDescription(String(t.tactic_description || ''));
    setTacticEditLibKind(String(t.tactic_kind || ''));
    setTacticEditLibChannel(String(t.channel || ''));
    setTacticEditLibMedium(String(t.medium || ''));
    setTacticEditLibFormat(String(t.format || ''));
    setTacticEditLibTagsCsv(Array.isArray(t.tags) ? t.tags.map(String).join(', ') : '');
    setTacticEditLibDefaultSuccessJson(JSON.stringify(t.default_success_metrics || {}, null, 2));
    setTacticEditLibDefaultDepsJson(JSON.stringify(t.default_dependencies || {}, null, 2));
    setTacticEditLibCadence(String(t.cadence || ''));
    setTacticEditLibEstimatedCostCents(t.estimated_cost_cents != null ? String(t.estimated_cost_cents) : '');
    setTacticEditLibCurrency(String(t.currency || ''));
    setTacticEditLibOwner(String(t.owner || ''));
    setTacticEditLibStatus((String(t.tactic_status || 'active') as 'draft' | 'active' | 'archived') || 'active');
    setTacticEditLibMetadataJson(JSON.stringify(t.tactic_metadata || {}, null, 2));

    setTacticEditLifecycleStatus((String(t.lifecycle_status || 'draft') as 'draft' | 'active' | 'paused' | 'completed' | 'archived') || 'draft');
    setTacticEditPriority(String(t.priority || 'medium'));
    setTacticEditStartAt(t.start_at ? String(t.start_at) : '');
    setTacticEditEndAt(t.end_at ? String(t.end_at) : '');
    setTacticEditObjectiveOverride(String(t.objective_override || ''));
    setTacticEditNotes(String(t.notes || ''));
    setTacticEditSuccessMetricsJson(JSON.stringify(t.success_metrics_override || {}, null, 2));
    setTacticEditDependenciesJson(JSON.stringify(t.dependencies_override || {}, null, 2));
    setTacticEditProjectMetadataJson(JSON.stringify(t.metadata || {}, null, 2));
  }, [setErr, setMsg]);

  const onSaveTacticEdits = useCallback(
    async (t: any) => {
      if (!selectedKey || !tacticEditId) return;
      setErr('');
      setMsg('');

      const sm = parseJsonField<Record<string, unknown>>('Success metrics override', tacticEditSuccessMetricsJson, {});
      if (sm.ok === false) return void setErr(sm.error);
      const depsJson = parseJsonField<Record<string, unknown>>('Dependencies override', tacticEditDependenciesJson, {});
      if (depsJson.ok === false) return void setErr(depsJson.error);
      const projMd = parseJsonField<Record<string, unknown>>('Project metadata', tacticEditProjectMetadataJson, {});
      if (projMd.ok === false) return void setErr(projMd.error);

      const defSm = parseJsonField<Record<string, unknown>>('Default success metrics', tacticEditLibDefaultSuccessJson, {});
      if (defSm.ok === false) return void setErr(defSm.error);
      const defDeps = parseJsonField<Record<string, unknown>>('Default dependencies', tacticEditLibDefaultDepsJson, {});
      if (defDeps.ok === false) return void setErr(defDeps.error);
      const libMd = parseJsonField<Record<string, unknown>>('Library metadata', tacticEditLibMetadataJson, {});
      if (libMd.ok === false) return void setErr(libMd.error);

      try {
        await patchProjectTactic(selectedKey, tacticEditId, {
          lifecycle_status: tacticEditLifecycleStatus,
          priority: tacticEditPriority.trim() || undefined,
          start_at: tacticEditStartAt.trim() || undefined,
          end_at: tacticEditEndAt.trim() || undefined,
          objective_override: tacticEditObjectiveOverride.trim() || undefined,
          notes: tacticEditNotes.trim() || undefined,
          success_metrics_override: sm.value,
          dependencies_override: depsJson.value,
          metadata: projMd.value,
        });

        if (t?.tactic_id) {
          const cost = tacticEditLibEstimatedCostCents.trim();
          await patchTacticLibrary(String(t.tactic_id), {
            name: tacticEditLibName.trim() || undefined,
            description: tacticEditLibDescription.trim() || undefined,
            tactic_kind: tacticEditLibKind.trim() || undefined,
            channel: tacticEditLibChannel.trim() || undefined,
            medium: tacticEditLibMedium.trim() || undefined,
            format: tacticEditLibFormat.trim() || undefined,
            tags: toTags(tacticEditLibTagsCsv),
            default_success_metrics: defSm.value,
            default_dependencies: defDeps.value,
            cadence: tacticEditLibCadence.trim() || undefined,
            estimated_cost_cents: cost ? Number(cost) : undefined,
            currency: tacticEditLibCurrency.trim() || undefined,
            owner: tacticEditLibOwner.trim() || undefined,
            status: tacticEditLibStatus,
            metadata: libMd.value,
          });
        }

        setMsg('Tactic updated.');
        await loadTactics(selectedKey);
        setTacticEditId(null);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [
      selectedKey,
      tacticEditId,
      tacticEditLifecycleStatus,
      tacticEditPriority,
      tacticEditStartAt,
      tacticEditEndAt,
      tacticEditObjectiveOverride,
      tacticEditNotes,
      tacticEditSuccessMetricsJson,
      tacticEditDependenciesJson,
      tacticEditProjectMetadataJson,
      tacticEditLibName,
      tacticEditLibDescription,
      tacticEditLibKind,
      tacticEditLibChannel,
      tacticEditLibMedium,
      tacticEditLibFormat,
      tacticEditLibTagsCsv,
      tacticEditLibDefaultSuccessJson,
      tacticEditLibDefaultDepsJson,
      tacticEditLibCadence,
      tacticEditLibEstimatedCostCents,
      tacticEditLibCurrency,
      tacticEditLibOwner,
      tacticEditLibStatus,
      tacticEditLibMetadataJson,
      loadTactics,
      setMsg,
      setErr,
    ],
  );

  const onDeleteTactic = useCallback(
    async (id: string) => {
      if (!selectedKey) return;
      setErr('');
      try {
        await deleteProjectTactic(selectedKey, id);
        await loadTactics(selectedKey);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [selectedKey, loadTactics, setErr],
  );

  return useMemo(
    () => ({
      tactics,
      setTactics,
      tacticSearch,
      setTacticSearch,
      tacticSearchRows,
      tacticLibraryLoading,
      tacticLibraryIsEmpty,
      tacticLibraryFilterEmpty,
      tacticAttachId,
      setTacticAttachId,
      tacticNewKey,
      setTacticNewKey,
      tacticNewName,
      setTacticNewName,
      tacticLifecycleStatus,
      setTacticLifecycleStatus,
      tacticPriority,
      setTacticPriority,
      tacticStartAt,
      setTacticStartAt,
      tacticEndAt,
      setTacticEndAt,
      tacticObjective,
      setTacticObjective,
      tacticNotes,
      setTacticNotes,
      tacticSuccessMetricsJson,
      setTacticSuccessMetricsJson,
      tacticDependenciesJson,
      setTacticDependenciesJson,
      tacticProjectMetadataJson,
      setTacticProjectMetadataJson,
      tacticLibDescription,
      setTacticLibDescription,
      tacticLibKind,
      setTacticLibKind,
      tacticLibChannel,
      setTacticLibChannel,
      tacticLibMedium,
      setTacticLibMedium,
      tacticLibFormat,
      setTacticLibFormat,
      tacticLibTagsCsv,
      setTacticLibTagsCsv,
      tacticLibDefaultSuccessJson,
      setTacticLibDefaultSuccessJson,
      tacticLibDefaultDepsJson,
      setTacticLibDefaultDepsJson,
      tacticLibDefaultStartOffsetDays,
      setTacticLibDefaultStartOffsetDays,
      tacticLibDefaultDurationDays,
      setTacticLibDefaultDurationDays,
      tacticLibCadence,
      setTacticLibCadence,
      tacticLibEstimatedCostCents,
      setTacticLibEstimatedCostCents,
      tacticLibCurrency,
      setTacticLibCurrency,
      tacticLibOwner,
      setTacticLibOwner,
      tacticLibStatus,
      setTacticLibStatus,
      tacticLibMetadataJson,
      setTacticLibMetadataJson,
      tacticEditId,
      setTacticEditId,
      tacticEditLibName,
      setTacticEditLibName,
      tacticEditLibDescription,
      setTacticEditLibDescription,
      tacticEditLibKind,
      setTacticEditLibKind,
      tacticEditLibChannel,
      setTacticEditLibChannel,
      tacticEditLibMedium,
      setTacticEditLibMedium,
      tacticEditLibFormat,
      setTacticEditLibFormat,
      tacticEditLibTagsCsv,
      setTacticEditLibTagsCsv,
      tacticEditLibDefaultSuccessJson,
      setTacticEditLibDefaultSuccessJson,
      tacticEditLibDefaultDepsJson,
      setTacticEditLibDefaultDepsJson,
      tacticEditLibCadence,
      setTacticEditLibCadence,
      tacticEditLibEstimatedCostCents,
      setTacticEditLibEstimatedCostCents,
      tacticEditLibCurrency,
      setTacticEditLibCurrency,
      tacticEditLibOwner,
      setTacticEditLibOwner,
      tacticEditLibStatus,
      setTacticEditLibStatus,
      tacticEditLibMetadataJson,
      setTacticEditLibMetadataJson,
      tacticEditLifecycleStatus,
      setTacticEditLifecycleStatus,
      tacticEditPriority,
      setTacticEditPriority,
      tacticEditStartAt,
      setTacticEditStartAt,
      tacticEditEndAt,
      setTacticEditEndAt,
      tacticEditObjectiveOverride,
      setTacticEditObjectiveOverride,
      tacticEditNotes,
      setTacticEditNotes,
      tacticEditSuccessMetricsJson,
      setTacticEditSuccessMetricsJson,
      tacticEditDependenciesJson,
      setTacticEditDependenciesJson,
      tacticEditProjectMetadataJson,
      setTacticEditProjectMetadataJson,
      loadTactics,
      loadTacticLibrarySearch,
      onAttachExistingTactic,
      onCreateAndAttachNewTactic,
      openEditTacticRow,
      onSaveTacticEdits,
      onDeleteTactic,
    }),
    [
      tactics,
      tacticSearch,
      tacticSearchRows,
      tacticLibraryLoading,
      tacticLibraryIsEmpty,
      tacticLibraryFilterEmpty,
      tacticAttachId,
      tacticNewKey,
      tacticNewName,
      tacticLifecycleStatus,
      tacticPriority,
      tacticStartAt,
      tacticEndAt,
      tacticObjective,
      tacticNotes,
      tacticSuccessMetricsJson,
      tacticDependenciesJson,
      tacticProjectMetadataJson,
      tacticLibDescription,
      tacticLibKind,
      tacticLibChannel,
      tacticLibMedium,
      tacticLibFormat,
      tacticLibTagsCsv,
      tacticLibDefaultSuccessJson,
      tacticLibDefaultDepsJson,
      tacticLibDefaultStartOffsetDays,
      tacticLibDefaultDurationDays,
      tacticLibCadence,
      tacticLibEstimatedCostCents,
      tacticLibCurrency,
      tacticLibOwner,
      tacticLibStatus,
      tacticLibMetadataJson,
      tacticEditId,
      tacticEditLibName,
      tacticEditLibDescription,
      tacticEditLibKind,
      tacticEditLibChannel,
      tacticEditLibMedium,
      tacticEditLibFormat,
      tacticEditLibTagsCsv,
      tacticEditLibDefaultSuccessJson,
      tacticEditLibDefaultDepsJson,
      tacticEditLibCadence,
      tacticEditLibEstimatedCostCents,
      tacticEditLibCurrency,
      tacticEditLibOwner,
      tacticEditLibStatus,
      tacticEditLibMetadataJson,
      tacticEditLifecycleStatus,
      tacticEditPriority,
      tacticEditStartAt,
      tacticEditEndAt,
      tacticEditObjectiveOverride,
      tacticEditNotes,
      tacticEditSuccessMetricsJson,
      tacticEditDependenciesJson,
      tacticEditProjectMetadataJson,
      loadTactics,
      loadTacticLibrarySearch,
      onAttachExistingTactic,
      onCreateAndAttachNewTactic,
      openEditTacticRow,
      onSaveTacticEdits,
      onDeleteTactic,
    ],
  );
}
