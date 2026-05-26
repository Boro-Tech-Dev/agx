'use client';

import { useEffect, useState } from 'react';

import { localIsoFromDate } from '../lib/timelineKeyDatesModel';

/**
 * Local calendar "today" (YYYY-MM-DD), refreshed when the calendar day changes
 * (interval + tab focus). Matches `<input type="date">`.
 */
export function useLocalTodayIso(): string {
  const [iso, setIso] = useState(() => localIsoFromDate());

  useEffect(() => {
    const sync = () => {
      const next = localIsoFromDate();
      setIso((prev) => (prev === next ? prev : next));
    };
    sync();
    const id = setInterval(sync, 60_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return iso;
}
