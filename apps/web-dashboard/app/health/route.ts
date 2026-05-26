import { NextResponse } from 'next/server';
import { agentApiBase } from '../../lib/server/agentApiBase';

export const dynamic = 'force-dynamic';

/** Same path as agent-api `/health` for load balancers probing the dashboard container. */
export async function GET() {
  const base = agentApiBase();
  try {
    const res = await fetch(`${base}/health`, { cache: 'no-store' });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'text/plain' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ detail: `Health proxy failed (${base}): ${msg}` }, { status: 502 });
  }
}
