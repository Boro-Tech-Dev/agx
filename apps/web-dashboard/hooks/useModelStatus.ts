'use client';

import { useModelStatusContext } from '../components/model/ModelStatusProvider';

/** Model status page data — shares one poll loop with the header Models dot. */
export function useModelStatus() {
  const { data, raw, error, loading, lastUpdated, refresh } = useModelStatusContext();
  return { data, raw, error, loading, lastUpdated, refresh };
}
