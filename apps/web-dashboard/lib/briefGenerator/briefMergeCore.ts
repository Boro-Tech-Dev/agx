import type {
  BriefFieldDef,
  BriefGeneratorDoc,
  BriefPresetEntry,
  BriefPresetsFile,
  BriefSectionDef,
  BriefSkeletonConfig,
  BriefTacticOverridesFile,
} from './types';

/** In-memory shape for skeleton + overrides + presets (matches API / static JSON). */
export type BriefTemplateBundle = {
  skeleton: BriefSkeletonConfig;
  tactic_overrides: BriefTacticOverridesFile;
  presets: BriefPresetsFile;
};

const INTERNAL_SECTION_ID = 'internal_production';

export function listPresetsForTactic(bundle: BriefTemplateBundle, tacticKey: string): BriefPresetEntry[] {
  return bundle.presets.presets.filter((p) => p.tactic_keys.includes(tacticKey));
}

export function getPresetById(bundle: BriefTemplateBundle, id: string | null | undefined): BriefPresetEntry | undefined {
  if (!id) return undefined;
  return bundle.presets.presets.find((p) => p.id === id);
}

export function hiddenSectionIdsForTactic(bundle: BriefTemplateBundle, tacticKey: string): Set<string> {
  const ovr = bundle.tactic_overrides.overrides[tacticKey];
  if (ovr?.hideSectionIds?.length) return new Set(ovr.hideSectionIds);
  if (tacticKey === 'slide_deck_scientific') return new Set();
  return new Set([INTERNAL_SECTION_ID]);
}

export function visibleSectionsForTactic(bundle: BriefTemplateBundle, tacticKey: string): BriefSectionDef[] {
  const hide = hiddenSectionIdsForTactic(bundle, tacticKey);
  return bundle.skeleton.sections.filter((s) => !hide.has(s.id));
}

export function allFieldIds(bundle: BriefTemplateBundle): string[] {
  const ids: string[] = [];
  for (const sec of bundle.skeleton.sections) {
    for (const f of sec.fields) ids.push(f.id);
  }
  return ids;
}

export function emptyValues(bundle: BriefTemplateBundle): Record<string, string> {
  const v: Record<string, string> = {};
  for (const id of allFieldIds(bundle)) v[id] = '';
  return v;
}

export function fieldHintFor(bundle: BriefTemplateBundle, tacticKey: string, fieldId: string): string | undefined {
  return bundle.tactic_overrides.overrides[tacticKey]?.fieldHints?.[fieldId];
}

export function mergeDefaultValues(
  bundle: BriefTemplateBundle,
  tacticKey: string,
  presetId: string | null,
): Record<string, string> {
  const base = emptyValues(bundle);
  const preset = getPresetById(bundle, presetId);
  if (preset && tacticKey && preset.tactic_keys.includes(tacticKey)) {
    for (const [k, val] of Object.entries(preset.field_defaults)) {
      if (k in base) base[k] = val;
    }
  }
  return base;
}

export function enrichFieldMeta(
  bundle: BriefTemplateBundle,
  tacticKey: string,
  field: BriefFieldDef,
): BriefFieldDef {
  const hint = fieldHintFor(bundle, tacticKey, field.id);
  if (!hint) return field;
  return {
    ...field,
    helper: field.helper ? `${field.helper}\n\n${hint}` : hint,
  };
}

export function parseBriefDoc(
  bundle: BriefTemplateBundle,
  raw: unknown,
): { ok: true; doc: BriefGeneratorDoc } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Invalid JSON' };
  const o = raw as Record<string, unknown>;
  if (o.kind !== 'brief_generator') return { ok: false, error: 'Not a brief_generator document' };
  if (o.version !== 1) return { ok: false, error: 'Unsupported version' };
  const values = o.values;
  if (!values || typeof values !== 'object') return { ok: false, error: 'Missing values' };
  const merged = emptyValues(bundle);
  for (const [k, v] of Object.entries(values as Record<string, unknown>)) {
    if (k in merged && typeof v === 'string') merged[k] = v;
  }
  return {
    ok: true,
    doc: {
      version: 1,
      kind: 'brief_generator',
      tactic_key: typeof o.tactic_key === 'string' ? o.tactic_key : null,
      preset_id: typeof o.preset_id === 'string' ? o.preset_id : null,
      values: merged,
      markdown_cache: typeof o.markdown_cache === 'string' ? o.markdown_cache : undefined,
      updated_at: typeof o.updated_at === 'string' ? o.updated_at : undefined,
    },
  };
}

export function buildBriefDocPayload(args: {
  tacticKey: string | null;
  presetId: string | null;
  values: Record<string, string>;
  markdown: string;
}): BriefGeneratorDoc {
  return {
    version: 1,
    kind: 'brief_generator',
    tactic_key: args.tacticKey,
    preset_id: args.presetId,
    values: { ...args.values },
    markdown_cache: args.markdown,
    updated_at: new Date().toISOString(),
  };
}
