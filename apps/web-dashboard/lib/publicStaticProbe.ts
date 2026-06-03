/** Paths that must never redirect to login (browser/SWG favicon and touch-icon probes). */
const PUBLIC_STATIC_PATHS = new Set([
  '/favicon.ico',
  '/icon.svg',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
]);

export function isPublicStaticAsset(pathname: string): boolean {
  return PUBLIC_STATIC_PATHS.has(pathname);
}
