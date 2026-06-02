import { describe, expect, it } from 'vitest';

import { base64ToBlob } from './downloadBase64';

describe('downloadBase64', () => {
  it('base64ToBlob decodes payload', () => {
    const blob = base64ToBlob('SGVsbG8=', 'text/plain');
    expect(blob.type).toBe('text/plain');
    expect(blob.size).toBe(5);
  });
});
