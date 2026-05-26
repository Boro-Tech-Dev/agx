/**
 * Library attach lists should include draft + active; exclude archived only.
 * (Using API `status=active` hides draft rows and empty DBs stay empty until seed.)
 */
export function filterLibraryRowsForAttach<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.filter((t) => String(t.status ?? '').toLowerCase() !== 'archived');
}

/**
 * Client-side filter for tactic library rows (name, key, channel, description).
 */
export function filterTacticsByQuery<T extends Record<string, unknown>>(rows: T[], q: string): T[] {
  const s = q.trim().toLowerCase();
  if (!s) return rows;
  return rows.filter((t) => {
    const name = String(t.name ?? '').toLowerCase();
    const key = String(t.key ?? '').toLowerCase();
    const channel = String(t.channel ?? '').toLowerCase();
    const desc = String(t.description ?? '').toLowerCase();
    return name.includes(s) || key.includes(s) || channel.includes(s) || desc.includes(s);
  });
}
