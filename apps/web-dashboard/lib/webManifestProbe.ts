/** Paths scanners/browsers probe when no PWA manifest is deployed. */
export function isWebManifestProbe(pathname: string): boolean {
  return pathname.endsWith('.webmanifest');
}
