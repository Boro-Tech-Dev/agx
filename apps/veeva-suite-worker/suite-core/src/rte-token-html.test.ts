import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import * as cheerio from 'cheerio';
import {
  highlightBracketPlaceholdersMagenta,
  wrapFragmentWithMagentaBrackets,
} from './rte-token-html.ts';

describe('wrapFragmentWithMagentaBrackets', () => {
  test('adds left and right magenta borders and preserves inner content', () => {
    const inner = '<table id="frag1"><tr><td>Body</td></tr></table>';
    const out = wrapFragmentWithMagentaBrackets(inner);
    assert.match(out, /rte-frag-frame/);
    assert.match(out, /border-left:2px solid #c800c8/);
    assert.match(out, /border-right:2px solid #c800c8/);
    assert.match(out, /id="frag1"/);
    const $ = cheerio.load(out);
    assert.equal($('#frag1').length, 1);
  });
});

describe('highlightBracketPlaceholdersMagenta', () => {
  test('colors bracket placeholders in text nodes', () => {
    const html = '<!DOCTYPE html><html><body><p>[Symptom Brochure] and more</p></body></html>';
    const out = highlightBracketPlaceholdersMagenta(html);
    assert.match(out, /#c800c8/);
    assert.match(out, /\[Symptom Brochure\]/);
  });

  test('does not alter bracket text inside attributes', () => {
    const html = '<!DOCTYPE html><html><body><a href="[not-a-placeholder]">x</a></body></html>';
    const out = highlightBracketPlaceholdersMagenta(html);
    assert.match(out, /href="\[not-a-placeholder\]"/);
    const $ = cheerio.load(out);
    assert.equal($('a span').length, 0);
  });
});
