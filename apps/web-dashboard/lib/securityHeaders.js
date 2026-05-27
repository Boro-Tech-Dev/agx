/**
 * HTTP security headers for production (idea-impact.com / corporate SWG posture).
 * Consumed by next.config.js `headers()` — keep in sync with docs/auth-keycloak.md verification.
 */

const isProduction = process.env.NODE_ENV === 'production';

const scriptSrc = isProduction
  ? "script-src 'self' 'unsafe-inline' chrome-extension:"
  : "script-src 'self' 'unsafe-inline'";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

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

module.exports = { securityHeaders };
