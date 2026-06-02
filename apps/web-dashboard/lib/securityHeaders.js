/**
 * HTTP security headers for production (idea-impact.com).
 * Aligns measurable signals with problematticsolutions.com: no CSP or Permissions-Policy.
 * Consumed by next.config.js `headers()` — keep in sync with docs/auth-keycloak.md verification.
 */

const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
];

module.exports = { securityHeaders };
