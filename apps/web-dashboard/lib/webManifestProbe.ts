/** Paths scanners/browsers probe when no PWA manifest is deployed. */
export function isWebManifestProbe(pathname: string): boolean {
  if (pathname === '/manifest.json') return true;
  return pathname.endsWith('.webmanifest');
}
