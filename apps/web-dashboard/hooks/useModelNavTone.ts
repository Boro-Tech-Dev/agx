'use client';

import { useModelStatusContext } from '../components/model/ModelStatusProvider';
import type { ModelNavTone } from '../lib/modelNavStatus';

/**
 * Traffic-light tone for Models nav links — derived from the shared model-status poll
 * (4s when degraded, 15s when healthy; refreshes on tab focus/visibility).
 */
export function useModelNavTone(): ModelNavTone {
  return useModelStatusContext().tone;
}

export function useModelNavOverview() {
  return useModelStatusContext().overviewForNav;
}
