import { describe, expect, it } from 'vitest';

import {
  buildLoginErrorUrl,
  capLoginErrorMessage,
  landingSigninFailedUrl,
  wantsJsonLoginResponse,
} from './loginRedirect';

describe('loginRedirect', () => {
  it('wantsJsonLoginResponse prefers JSON when HTML is not accepted', () => {
    expect(wantsJsonLoginResponse('application/json')).toBe(true);
    expect(wantsJsonLoginResponse('application/json, text/plain')).toBe(true);
    expect(wantsJsonLoginResponse('text/html, application/json')).toBe(false);
    expect(wantsJsonLoginResponse('text/html')).toBe(false);
    expect(wantsJsonLoginResponse(null)).toBe(false);
  });

  it('buildLoginErrorUrl encodes error and safe next', () => {
    const url = buildLoginErrorUrl('https://idea-impact.com', 'Invalid username or password.', '/tools');
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('error')).toBe('Invalid username or password.');
    expect(url.searchParams.get('next')).toBe('/tools');
  });

  it('buildLoginErrorUrl rejects open redirects in next', () => {
    const url = buildLoginErrorUrl('https://idea-impact.com', 'Failed', '//evil');
    expect(url.searchParams.get('next')).toBe('/home');
  });

  it('capLoginErrorMessage trims and caps length', () => {
    expect(capLoginErrorMessage('  oops  ')).toBe('oops');
    expect(capLoginErrorMessage('x'.repeat(400)).length).toBeLessThanOrEqual(281);
  });

  it('landingSigninFailedUrl uses signin=failed only (no raw error text)', () => {
    const url = landingSigninFailedUrl('https://idea-impact.com');
    expect(url.pathname).toBe('/');
    expect(url.searchParams.get('signin')).toBe('failed');
    expect(url.searchParams.get('error')).toBeNull();
    expect(url.href).not.toContain('password');
  });
});
