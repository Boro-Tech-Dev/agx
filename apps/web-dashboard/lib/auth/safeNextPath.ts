/** Same-origin relative path only (open-redirect safe). */
export function safeNextPath(raw: string | null | undefined): string {
  if (raw == null || raw === '') return '/';
  const t = raw.trim();
  if (!t.startsWith('/') || t.startsWith('//')) return '/';
  return t;
}
