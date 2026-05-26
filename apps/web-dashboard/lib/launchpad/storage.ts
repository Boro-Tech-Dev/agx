import { createLaunch } from './engine';
import type { LaunchpadLaunch } from './types';

const LS_KEY = 'dd.launchpad.launches.v1';
const ACTIVE_KEY = 'dd.launchpad.activeLaunchId.v1';

export function loadLaunches(): LaunchpadLaunch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLaunches(launches: LaunchpadLaunch[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(launches));
  } catch {
    // Ignore quota/security errors; Launchpad remains usable for the current session.
  }
}

export function loadActiveLaunchId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function saveActiveLaunchId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // Ignore quota/security errors.
  }
}

export function demoLaunch(): LaunchpadLaunch {
  const launch = createLaunch({
    name: 'Sample HCP Wave Launch',
    brand: 'Demo Brand',
    client: 'Demo Client',
    owner: 'PM Lead',
    targetLaunchDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString().slice(0, 10),
  });
  return launch;
}
