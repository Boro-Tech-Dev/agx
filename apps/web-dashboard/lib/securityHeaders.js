/**
 * HTTP security headers for production (idea-impact.com / corporate SWG posture).
 * Consumed by next.config.js `headers()` — keep in sync with docs/auth-keycloak.md verification.
 */

const isProduction = process.env.NODE_ENV === 'production';

/**
 * @param {{ production?: boolean }} [opts]
 * @returns {string}
 */
function buildContentSecurityPolicy(opts = {}) {
  const production = opts.production ?? isProduction;

  const scriptSrc = production
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline'";

  const connectSrc = production ? "connect-src 'self'" : "connect-src 'self' https:";

  const imgSrc = production ? "img-src 'self' data: blob:" : "img-src 'self' data: blob: https:";

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    imgSrc,
    "font-src 'self' data:",
    connectSrc,
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

const CONTENT_SECURITY_POLICY = buildContentSecurityPolicy();

const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
];

module.exports = { securityHeaders, buildContentSecurityPolicy };
