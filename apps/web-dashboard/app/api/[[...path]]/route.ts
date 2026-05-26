import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { agentApiBase } from '../../../lib/server/agentApiBase';
import { resolveDashboardUserSub } from '../../../lib/server/dashboardUserSub';
import { resolveDashboardSession } from '../../../lib/server/resolveDashboardSession';

export const dynamic = 'force-dynamic';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

function forwardHeaders(src: Headers, dest: Headers) {
  src.forEach((value, key) => {
    const lk = key.toLowerCase();
    if (lk === 'host') return;
    if (HOP_BY_HOP.has(lk)) return;
    dest.set(key, value);
  });
}

async function proxy(req: NextRequest, pathSegments: string[] | undefined) {
  const session = await resolveDashboardSession(req);
  if (session.kind === 'unauthorized') {
    const denied = NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
    session.applyClearCookies(denied, req);
    return denied;
  }

  const base = agentApiBase();
  const apiPath = pathSegments?.length ? `/api/${pathSegments.join('/')}` : '/api';
  const url = new URL(req.url);
  const target = `${base}${apiPath}${url.search}`;

  const headers = new Headers();
  forwardHeaders(req.headers, headers);
  const userSub = await resolveDashboardUserSub(req);
  if (userSub) headers.set('X-Dashboard-User-Sub', userSub);

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const init: RequestInit & { duplex?: 'half' } = {
    method: req.method,
    headers,
    redirect: 'manual',
  };
  if (hasBody && req.body) {
    init.body = req.body;
    init.duplex = 'half';
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const errRes = NextResponse.json(
      { detail: `Agent API proxy failed (${base}): ${msg}` },
      { status: 502 },
    );
    if (session.kind === 'refreshed') {
      session.applySessionCookies(errRes, req);
    }
    return errRes;
  }

  const outHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    outHeaders.set(key, value);
  });

  const out = new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  });
  if (session.kind === 'refreshed') {
    session.applySessionCookies(out, req);
  }
  return out;
}

export async function GET(req: NextRequest, ctx: { params: { path?: string[] } }) {
  return proxy(req, ctx.params.path);
}

export async function HEAD(req: NextRequest, ctx: { params: { path?: string[] } }) {
  return proxy(req, ctx.params.path);
}

export async function POST(req: NextRequest, ctx: { params: { path?: string[] } }) {
  return proxy(req, ctx.params.path);
}

export async function PUT(req: NextRequest, ctx: { params: { path?: string[] } }) {
  return proxy(req, ctx.params.path);
}

export async function PATCH(req: NextRequest, ctx: { params: { path?: string[] } }) {
  return proxy(req, ctx.params.path);
}

export async function DELETE(req: NextRequest, ctx: { params: { path?: string[] } }) {
  return proxy(req, ctx.params.path);
}

export async function OPTIONS(req: NextRequest, ctx: { params: { path?: string[] } }) {
  return proxy(req, ctx.params.path);
}
