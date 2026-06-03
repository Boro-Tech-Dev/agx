/** Plain HTML landing for `/` — no React, no _next/static (RBI mitigation). */

export type LandingPageOptions = {
  signinFailed: boolean;
  /** IdP hostname shown for cross-origin trust signal (e.g. auth.idea-impact.com). */
  idpHost: string;
};

const LANDING_STYLES = `
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;min-height:100%}
body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#0d1114;color:#e8eef2;line-height:1.5;-webkit-font-smoothing:antialiased}
main{max-width:32rem;margin:0 auto;padding:2.5rem 1.25rem}
h1{margin:0 0 .75rem;font-size:1.25rem;font-weight:700;letter-spacing:.04em}
p{margin:0 0 1rem;font-size:14px;color:rgba(232,238,242,.8)}
.idp-note{margin:0 0 1.25rem;font-size:13px;color:rgba(232,238,242,.65)}
.idp-note strong{font-weight:600;color:#00d9ff}
.cta{display:inline-block;padding:.55rem 1.1rem;background:#00d9ff;color:#0d1114;font-size:13px;font-weight:600;text-decoration:none;border-radius:2px}
.cta:hover{background:#00a0b5}
.notice{margin:0 0 1rem;padding:.5rem .65rem;border:1px solid rgba(244,63,94,.35);background:rgba(244,63,94,.1);color:#fecdd3;font-size:13px;border-radius:2px}
`.trim();

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildLandingHtml({ signinFailed, idpHost }: LandingPageOptions): string {
  const safeIdpHost = escapeHtml(idpHost);
  const notice = signinFailed
    ? '<p class="notice" role="alert">Unable to sign in. Try again.</p>'
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>RagTag</title>
<meta name="description" content="PM Operator Grid — specialist agents and operator tools."/>
<style>${LANDING_STYLES}</style>
</head>
<body>
<main>
<h1>RagTag</h1>
<p>Specialist agents, project workspaces, and operator tools for delivery, capture, and planning.</p>
${notice}
<p class="idp-note">You&rsquo;ll be redirected to <strong>${safeIdpHost}</strong> to sign in.</p>
<a class="cta" href="/api/auth/login">Continue to RagTag</a>
</main>
</body>
</html>`;
}
