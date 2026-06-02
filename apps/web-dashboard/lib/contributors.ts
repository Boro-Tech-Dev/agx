/**
 * People who helped build the platform — edit names, roles, and optional links here.
 */

export type ContributorEntry = {
  /** Display name (used for initials when no photo). */
  name: string;
  /** Short role or thank-you line. */
  role?: string;
  /** Optional external profile URL (e.g. LinkedIn, GitHub). */
  href?: string;
  /** Accessible label for the link; defaults to "Profile". */
  linkLabel?: string;
};

export function contributorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0];
    const b = parts[parts.length - 1][0];
    if (a && b) return (a + b).toUpperCase();
  }
  const w = parts[0] ?? '?';
  return w.slice(0, 2).toUpperCase();
}

export const CONTRIBUTORS: readonly ContributorEntry[] = [
  {
    name: 'Contributor name',
    role: 'Add role or thanks here',
  },
  {
    name: 'Another colleague',
    role: 'Replace with real names and blurbs',
  },
  {
    name: 'Teammate three',
    role: 'Optional profile link — set href and linkLabel when ready',
  },
] as const;
