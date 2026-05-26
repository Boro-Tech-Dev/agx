import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  SUBMISSION_PAGE_COUNT,
  buildSubmissionPageCount,
  computeFitScale,
} from './submission-pdf.ts';

describe('submission layout helpers', () => {
  test('buildSubmissionPageCount is always 3', () => {
    assert.equal(buildSubmissionPageCount(), 3);
    assert.equal(SUBMISSION_PAGE_COUNT, 3);
  });

  test('computeFitScale never upscales above 1', () => {
    assert.equal(computeFitScale(100, 200, 1000, 1000), 1);
    assert.equal(computeFitScale(1200, 3000, 600, 400), 0.13333333333333333);
    const scale = computeFitScale(800, 4000, 960, 720);
    assert.ok(scale <= 1);
    assert.ok(scale > 0);
  });

  test('computeFitScale fits within box', () => {
    const w = 600;
    const h = 5000;
    const boxW = 400;
    const boxH = 600;
    const scale = computeFitScale(w, h, boxW, boxH);
    assert.ok(w * scale <= boxW + 0.01);
    assert.ok(h * scale <= boxH + 0.01);
  });
});
