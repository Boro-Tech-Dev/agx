/**
 * Resolve agent-api base URL for server-side proxy (runtime env).
 * Order: AGENT_API_URL → NEXT_PUBLIC_AGENT_API_URL → localhost (local dev).
 */
export function agentApiBase(): string {
  const primary = (process.env.AGENT_API_URL || '').trim();
  if (primary) return primary.replace(/\/$/, '');
  const pub = (process.env.NEXT_PUBLIC_AGENT_API_URL || '').trim();
  if (pub) return pub.replace(/\/$/, '');
  return 'http://localhost:8080';
}
