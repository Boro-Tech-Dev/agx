# DD Agent Dashboard (Next.js)

## API traffic and server load

By default the browser calls same-origin `/api/*`. The [`app/api/[[...path]]/route.ts`](app/api/[[...path]]/route.ts) proxy forwards to `AGENT_API_URL` (agent-api). Middleware skips JWT verification for `/api/*` so the proxy route performs `resolveDashboardSession` (access JWT verification and Keycloak refresh when needed) per request.

If you set **`NEXT_PUBLIC_AGENT_API_URL`** to the agent-api base URL (e.g. `http://localhost:8080`), the **browser** will call agent-api **directly** from client components, bypassing the Next.js proxy for those requests. You must enable **CORS** on agent-api for the dashboard origin and ensure **authentication** still works (e.g. cookies do not cross origins unless configured). Use only when you accept that tradeoff to reduce load on the Next server.

## Theme (SSR)

Explicit light/dark choice is stored in `localStorage` (`dd-theme`) and mirrored in the `dd_theme` cookie so the root layout can emit `<html class="dark">` on the server and avoid a light first paint.
