import { describe, expect, it } from 'vitest';

import { buildLandingHtml } from './landingPage';

describe('buildLandingHtml', () => {
  it('returns plain HTML without Next.js assets or password fields', () => {
    const html = buildLandingHtml({ signinFailed: false, idpHost: 'auth.example.com' });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).not.toContain('_next/static');
    expect(html).not.toMatch(/type=["']password["']/i);
    expect(html).not.toContain('idea-impact.com');
    expect(html).toContain('href="/api/auth/login"');
    expect(html).toContain('auth.example.com');
  });

  it('uses flat layout without login-panel class names', () => {
    const html = buildLandingHtml({ signinFailed: false, idpHost: 'auth.example.com' });
    expect(html).not.toContain('landing-panel');
    expect(html).not.toContain('Sign in');
    expect(html).toContain('Continue to RagTag');
  });

  it('shows generic notice when signinFailed is true', () => {
    const html = buildLandingHtml({ signinFailed: true, idpHost: 'auth.example.com' });
    expect(html).toContain('Unable to sign in. Try again.');
    expect(html).not.toContain('password');
  });

  it('escapes idp host in HTML', () => {
    const html = buildLandingHtml({ signinFailed: false, idpHost: 'auth<script>.evil' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('auth&lt;script&gt;.evil');
  });
});
