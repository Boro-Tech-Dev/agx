/** Same-origin relative path only (open-redirect safe). Default post-login target is /home. */
export function safeNextPath(raw: string | null | undefined): string {
  if (raw == null || raw === '') return '/home';
  const t = raw.trim();
  if (!t.startsWith('/') || t.startsWith('//')) return '/home';
  return t;
}
