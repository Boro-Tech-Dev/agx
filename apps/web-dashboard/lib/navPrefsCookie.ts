/** Cookie + server parse for dashboard Agents strip expand/collapse (mirrors localStorage). */
export const NAV_AGENTS_EXPANDED_COOKIE = 'dd_nav_agents_expanded';

/** Sidebar "Operations" group (Approvals … Queues) expand/collapse. */
export const NAV_OPS_EXPANDED_COOKIE = 'dd_nav_ops_expanded';

/** Sidebar "Tools" catalog group expand/collapse. */
export const NAV_TOOLS_EXPANDED_COOKIE = 'dd_nav_tools_expanded';

const MAX_AGE_SEC = 60 * 60 * 24 * 400;

/** Server + client: treat missing or non-`0` as expanded (default). */
export function parseAgentsExpandedCookie(value: string | undefined): boolean {
  if (value === '0') return false;
  return true;
}

export const parseOpsExpandedCookie = parseAgentsExpandedCookie;
export const parseToolsExpandedCookie = parseAgentsExpandedCookie;

export function writeAgentsExpandedCookieClient(expanded: boolean) {
  if (typeof document === 'undefined') return;
  const v = expanded ? '1' : '0';
  document.cookie = `${NAV_AGENTS_EXPANDED_COOKIE}=${v}; Path=/; Max-Age=${MAX_AGE_SEC}; SameSite=Lax`;
}

export function writeOpsExpandedCookieClient(expanded: boolean) {
  if (typeof document === 'undefined') return;
  const v = expanded ? '1' : '0';
  document.cookie = `${NAV_OPS_EXPANDED_COOKIE}=${v}; Path=/; Max-Age=${MAX_AGE_SEC}; SameSite=Lax`;
}

export function writeToolsExpandedCookieClient(expanded: boolean) {
  if (typeof document === 'undefined') return;
  const v = expanded ? '1' : '0';
  document.cookie = `${NAV_TOOLS_EXPANDED_COOKIE}=${v}; Path=/; Max-Age=${MAX_AGE_SEC}; SameSite=Lax`;
}

/** Parsed value from `document.cookie`, or `null` if the cookie is absent. */
export function readAgentsExpandedFromDocumentCookie(): boolean | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const s = part.trim();
    if (!s.startsWith(`${NAV_AGENTS_EXPANDED_COOKIE}=`)) continue;
    const raw = decodeURIComponent(s.slice(NAV_AGENTS_EXPANDED_COOKIE.length + 1));
    return parseAgentsExpandedCookie(raw);
  }
  return null;
}

export function readOpsExpandedFromDocumentCookie(): boolean | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const s = part.trim();
    if (!s.startsWith(`${NAV_OPS_EXPANDED_COOKIE}=`)) continue;
    const raw = decodeURIComponent(s.slice(NAV_OPS_EXPANDED_COOKIE.length + 1));
    return parseOpsExpandedCookie(raw);
  }
  return null;
}

export function readToolsExpandedFromDocumentCookie(): boolean | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const s = part.trim();
    if (!s.startsWith(`${NAV_TOOLS_EXPANDED_COOKIE}=`)) continue;
    const raw = decodeURIComponent(s.slice(NAV_TOOLS_EXPANDED_COOKIE.length + 1));
    return parseToolsExpandedCookie(raw);
  }
  return null;
}
