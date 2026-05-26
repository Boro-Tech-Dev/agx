'use client';

import { useCallback, useEffect, useState } from 'react';

import { getPublishedBriefTemplates } from '../api';
import type { BriefPresetsFile, BriefSkeletonConfig, BriefTacticOverridesFile } from './types';

import type { BriefTemplateBundle } from './briefMergeCore';
import { staticBriefTemplateBundle } from './mergeBriefTemplate';

function coerceBundle(row: {
  skeleton: unknown;
  tactic_overrides: unknown;
  presets: unknown;
}): BriefTemplateBundle {
  return {
    skeleton: row.skeleton as BriefSkeletonConfig,
    tactic_overrides: row.tactic_overrides as BriefTacticOverridesFile,
    presets: row.presets as BriefPresetsFile,
  };
}

export function useBriefTemplateConfig() {
  const [bundle, setBundle] = useState<BriefTemplateBundle>(staticBriefTemplateBundle);
  const [loading, setLoading] = useState(true);
  const [fromApi, setFromApi] = useState(false);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const row = await getPublishedBriefTemplates();
      setBundle(coerceBundle(row));
      setFromApi(true);
      setPublishedVersion(typeof row.version === 'number' ? row.version : null);
    } catch {
      setBundle(staticBriefTemplateBundle);
      setFromApi(false);
      setPublishedVersion(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { bundle, loading, fromApi, publishedVersion, reload };
}
