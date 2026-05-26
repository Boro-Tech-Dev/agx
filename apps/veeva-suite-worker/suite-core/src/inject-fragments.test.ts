import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import { assertRteAssembledStructure, assembleVeevaZip, injectFragments } from './index.ts';

const warnings: { severity: string; code: string; message: string }[] = [];

function shellWithToken(): string {
  return `<!DOCTYPE html><html><head><title>t</title></head><body>
<div id="body_style">
<table width="600" align="center" class="wrapper" cellpadding="0" cellspacing="0"><tbody><tr><td align="center">
<table width="100%"><tbody><tr><td style="padding:10px">
<p>Intro</p>
{{insertEmailFragments}}
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" bgcolor="#181153"><tbody><tr><td>FOOTER</td></tr></tbody></table>
</td></tr></tbody></table>
</td></tr></tbody></table>
</div>
</body></html>`;
}

describe('injectFragments', () => {
  test('splices multiple fragment tables inside the token cell; footer stays under table.wrapper', () => {
    const fragHtml =
      '<table width="100%" id="f1"><tbody><tr><td>Fragment 1</td></tr></tbody></table>' +
      '<table width="100%" id="f2"><tbody><tr><td>Fragment 2</td></tr></tbody></table>';
    const out = injectFragments(shellWithToken(), fragHtml, warnings);
    const $ = cheerio.load(out);
    assert.equal($('#f1').length, 1);
    assert.equal($('#f2').length, 1);
    const footer = $('table[bgcolor="#181153"]').first();
    assert.ok(footer.length);
    assert.ok(footer.closest('table.wrapper').length);
    assertRteAssembledStructure(out);
  });

  test('data-rte-fragments marker inserts HTML and preserves document', () => {
    const shell = `<!DOCTYPE html><html><body><table class="wrapper"><tr><td><div data-rte-fragments></div></td></tr></table></body></html>`;
    const out = injectFragments(shell, '<span id="x">hi</span>', warnings);
    const $ = cheerio.load(out);
    assert.equal($('#x').text(), 'hi');
  });

  test('throws when no placeholder and no marker', () => {
    assert.throws(
      () => injectFragments('<html><body><p>no slot</p></body></html>', '<table></table>', warnings),
      /no fragment placeholder|fragment slot/i,
    );
  });

  test('throws when {{insertEmailFragments}} appears more than once', () => {
    const bad = '<html><body>{{insertEmailFragments}} {{insertEmailFragments}}</body></html>';
    assert.throws(() => injectFragments(bad, '<table></table>', warnings), /exactly once/i);
  });
});

describe('assembleVeevaZip RTE integration', () => {
  test('hoists fragment <head><style> into assembled-email head so CSS is not dropped', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rte-style-'));
    const zipPath = path.join(tmp, 'in.zip');
    const shell = `<!DOCTYPE html><html><head><title>x</title><style>body{margin:0}</style></head><body>
<table width="600" class="wrapper"><tbody><tr><td align="center">
{{insertEmailFragments}}
</td></tr></tbody></table></body></html>`;
    const frag = `<!DOCTYPE html><html><head><style>.rte-frag-unique-layout-test{display:block;color:rgb(17,24,39)}</style></head><body><table width="100%"><tr><td class="rte-frag-unique-layout-test">CELL</td></tr></table></body></html>`;
    const z = new AdmZip();
    z.addFile('index.html', Buffer.from(shell, 'utf8'));
    z.addFile('fragments/1.html', Buffer.from(frag, 'utf8'));
    z.writeZip(zipPath);
    const outDir = path.join(tmp, 'out');
    const workDir = path.join(tmp, 'work');
    await fs.mkdir(outDir, { recursive: true });
    await fs.mkdir(workDir, { recursive: true });
    try {
      const result = await assembleVeevaZip({
        sourceZipPath: zipPath,
        outputBaseDir: outDir,
        workBaseDir: workDir,
        webPathPrefix: '',
      });
      const assembled = await fs.readFile(path.join(result.outputDir, 'assembled-email.html'), 'utf8');
      assert.match(assembled, /<head[^>]*>[\s\S]*rte-frag-unique-layout-test[\s\S]*<\/head>/i);
      assert.ok(assembled.includes('<!-- rte-fragment-styles:1 -->'));
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  test('assembled-email.html passes footer-under-wrapper validation', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rte-int-'));
    const zipPath = path.join(tmp, 'in.zip');
    const shell = `<!DOCTYPE html><html><head><title>x</title></head><body>
<div id="body_style"><table width="600" class="wrapper"><tbody><tr><td align="center">
<p>Hi</p>{{insertEmailFragments}}
<table bgcolor="#181153" width="100%"><tbody><tr><td>Legal</td></tr></tbody></table>
</td></tr></tbody></table></div></body></html>`;
    const frag = `<!DOCTYPE html><html><body><table width="100%" id="fragtab"><tr><td>F</td></tr></table></body></html>`;
    const z = new AdmZip();
    z.addFile('index.html', Buffer.from(shell, 'utf8'));
    z.addFile('fragments/1.html', Buffer.from(frag, 'utf8'));
    z.writeZip(zipPath);
    const outDir = path.join(tmp, 'out');
    const workDir = path.join(tmp, 'work');
    await fs.mkdir(outDir, { recursive: true });
    await fs.mkdir(workDir, { recursive: true });
    try {
      const result = await assembleVeevaZip({
        sourceZipPath: zipPath,
        outputBaseDir: outDir,
        workBaseDir: workDir,
        webPathPrefix: '',
      });
      const assembled = await fs.readFile(path.join(result.outputDir, 'assembled-email.html'), 'utf8');
      assertRteAssembledStructure(assembled);
      await fs.access(path.join(result.outputDir, 'assembled-email-processed.html'));
      await fs.access(path.join(result.outputDir, 'assembled-email-tokens.html'));
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  test('QA assembled-email keeps raw merge tokens; processed applies token map', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rte-qa-raw-'));
    const zipPath = path.join(tmp, 'in.zip');
    const shell = `<!DOCTYPE html><html><head><title>x</title></head><body>
<div id="body_style"><table width="600" class="wrapper"><tbody><tr><td align="center">
<p>{{RecipientName}}</p>{{insertEmailFragments}}
<table bgcolor="#181153" width="100%"><tbody><tr><td>Legal</td></tr></tbody></table>
</td></tr></tbody></table></div></body></html>`;
    const frag = `<!DOCTYPE html><html><body><table width="100%" id="fragtab"><tr><td>F</td></tr></table></body></html>`;
    const z = new AdmZip();
    z.addFile('index.html', Buffer.from(shell, 'utf8'));
    z.addFile('fragments/1.html', Buffer.from(frag, 'utf8'));
    z.writeZip(zipPath);
    const outDir = path.join(tmp, 'out');
    const workDir = path.join(tmp, 'work');
    await fs.mkdir(outDir, { recursive: true });
    await fs.mkdir(workDir, { recursive: true });
    try {
      const result = await assembleVeevaZip({
        sourceZipPath: zipPath,
        outputBaseDir: outDir,
        workBaseDir: workDir,
        webPathPrefix: '',
        tokenMap: { '{{RecipientName}}': 'Dr McFly,' },
      });
      const qa = await fs.readFile(path.join(result.outputDir, 'assembled-email.html'), 'utf8');
      const processed = await fs.readFile(path.join(result.outputDir, 'assembled-email-processed.html'), 'utf8');
      assert.match(qa, /\{\{RecipientName\}\}|fff3cd[\s\S]*RecipientName/i);
      assert.match(processed, /Dr McFly/);
      assert.ok(!processed.includes('{{RecipientName}}'));
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  test('tokens HTML has fragment brackets and magenta placeholders; processed HTML does not', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rte-tokens-frag-'));
    const zipPath = path.join(tmp, 'in.zip');
    const shell = `<!DOCTYPE html><html><head><title>x</title></head><body>
<div id="body_style"><table width="600" class="wrapper"><tbody><tr><td align="center">
<p>Hi</p>{{insertEmailFragments}}
<table bgcolor="#181153" width="100%"><tbody><tr><td>Legal</td></tr></tbody></table>
</td></tr></tbody></table></div></body></html>`;
    const frag = `<!DOCTYPE html><html><body><table width="100%" id="fragtab"><tr><td>[Placeholder]</td></tr></table></body></html>`;
    const z = new AdmZip();
    z.addFile('index.html', Buffer.from(shell, 'utf8'));
    z.addFile('fragments/1.html', Buffer.from(frag, 'utf8'));
    z.writeZip(zipPath);
    const outDir = path.join(tmp, 'out');
    const workDir = path.join(tmp, 'work');
    await fs.mkdir(outDir, { recursive: true });
    await fs.mkdir(workDir, { recursive: true });
    try {
      const result = await assembleVeevaZip({
        sourceZipPath: zipPath,
        outputBaseDir: outDir,
        workBaseDir: workDir,
        webPathPrefix: '',
      });
      const tokens = await fs.readFile(path.join(result.outputDir, 'assembled-email-tokens.html'), 'utf8');
      assert.match(tokens, /rte-frag-frame|border-left:2px solid #c800c8/i);
      assert.match(tokens, /#c800c8[\s\S]*\[Placeholder\]|\[Placeholder\][\s\S]*#c800c8|color:#c800c8[^>]*>\[Placeholder\]/i);

      const processed = await fs.readFile(path.join(result.outputDir, 'assembled-email-processed.html'), 'utf8');
      assert.ok(!processed.includes('rte-frag-frame'));
      assert.ok(!processed.includes('border-left:2px solid #c800c8'));
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});

describe('assertRteAssembledStructure', () => {
  test('passes when footer is nested inside table.wrapper', () => {
    const html =
      '<html><body><table class="wrapper"><tr><td><table bgcolor="#181153"><tr><td>f</td></tr></table></td></tr></table></body></html>';
    assert.doesNotThrow(() => assertRteAssembledStructure(html));
  });

  test('no-op when Blueprint footer table is absent', () => {
    assert.doesNotThrow(() => assertRteAssembledStructure('<html><body><table class="wrapper"></table></body></html>'));
  });

  test('throws when footer exists but is not inside table.wrapper', () => {
    const html =
      '<html><body><table class="wrapper"><tr><td></td></tr></table><table bgcolor="#181153"><tr><td>x</td></tr></table></body></html>';
    assert.throws(() => assertRteAssembledStructure(html), /nested inside table\.wrapper/i);
  });

  test('throws when footer exists but table.wrapper is missing', () => {
    const html = '<html><body><table bgcolor="#181153"><tr><td>x</td></tr></table></body></html>';
    assert.throws(() => assertRteAssembledStructure(html), /no table\.wrapper/i);
  });
});
