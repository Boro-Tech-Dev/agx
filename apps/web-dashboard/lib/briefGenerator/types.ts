export type BriefFieldDef = {
  id: string;
  label: string;
  helper?: string;
  placeholder?: string;
  rows?: number;
};

export type BriefSectionDef = {
  id: string;
  title: string;
  fields: BriefFieldDef[];
};

export type BriefSkeletonConfig = {
  version: number;
  sections: BriefSectionDef[];
};

export type BriefTacticOverridesFile = {
  version: number;
  overrides: Record<
    string,
    {
      fieldHints?: Record<string, string>;
      hideSectionIds?: string[];
    }
  >;
};

export type BriefPresetEntry = {
  id: string;
  label: string;
  tactic_keys: string[];
  field_defaults: Record<string, string>;
};

export type BriefPresetsFile = {
  version: number;
  presets: BriefPresetEntry[];
};

/** Persisted brief document (uploaded JSON). */
export type BriefGeneratorDoc = {
  version: 1;
  kind: 'brief_generator';
  tactic_key: string | null;
  preset_id: string | null;
  values: Record<string, string>;
  markdown_cache?: string;
  updated_at?: string;
};
