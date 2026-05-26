import AdmZip from 'adm-zip';
import archiver from 'archiver';
import * as cheerio from 'cheerio';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';

export type PackageType = 'rte' | 'clm' | 'unknown';
export type ReviewUnit = {
  id: string;
  name: string;
  sourcePath: string;
  previewPath: string;
  screenshotPath?: string;
  htmlLength: number;
  imagesCopied?: number;
  dimensions?: string;
  type?: 'fragment' | 'slide';
};
export type InventoryItem = {
  type: 'link' | 'image' | 'token' | 'script' | 'video' | 'veeva-api' | 'asset';
  value: string;
  label?: string;
  source: 'shell' | 'fragment' | 'assembled' | 'slide' | 'package';
  unitName?: string;
  status: 'ok' | 'warning' | 'error';
  message?: string;
};
export type AssemblyWarning = { severity: 'info' | 'warning' | 'error'; code: string; message: string; source?: string };
export type TokenMap = Record<string, string>;
/** webPathPrefix: browser-visible base (e.g. `/api/veeva-suite`) so generated HTML links work behind agent-api + Next proxy. Empty = legacy `/outputs/...` and `/api/suite-runs/.../download`. */
export type AssembleOptions = {
  sourceZipPath: string;
  outputBaseDir: string;
  workBaseDir: string;
  webPathPrefix?: string;
  publicOutputBaseUrl?: string;
  tokenMap?: TokenMap;
  enableScreenshots?: boolean;
};
export type AssemblyResult = {
  id: string;
  packageType: PackageType;
  sourceName: string;
  rootName: string;
  fragmentCount: number;
  slideCount: number;
  fragments: ReviewUnit[];
  slides: ReviewUnit[];
  warnings: AssemblyWarning[];
  inventory: InventoryItem[];
  navigation: { from: string; to: string; reason: string }[];
  outputDir: string;
  previewHtmlPath: string;
  assembledHtmlPath?: string;
  reportHtmlPath: string;
  reportPdfPath?: string;
  manifestPath: string;
  zipPath: string;
  screenshots: {
    fullPage?: string;
    viewport600?: string;
    viewport400?: string;
    fragments: string[];
    slides: string[];
  };
  submissionPdfPath?: string;
  submissionMeta?: {
    emailTitle: string;
    subjectLines: string[];
    toAddress?: string;
    fromAddress?: string;
    previewMode?: 'tokens' | 'processed';
    generatedAt: string;
  };
  tokenMap?: TokenMap;
};

const DEFAULT_TOKENS: TokenMap = {
  '{{customText[Dear|Hello|Hi]}}': 'Hello',
  '{{customText(200)}}': 'I thought these resources may be useful.',
  '{{customText}}': 'Please let me know if you would like additional information.',
  '{{userPhoto}}': '',
  '{{PieceLink}}': '#',
  '{{unsubscribe_product_link}}': '#',
  '{{unsubscribeLink}}': '#',
  '{{userName}}': 'Pat Smith',
  '{{User.Title}}': 'Medical Science Liaison',
  '{{User.Phone}}': '(555) 555-0100',
  '{{userEmailAddress}}': 'rep@example.com',
  '##accFname##': 'Sample',
  '##accLname##': 'Recipient',
  '##User.FirstName##': 'Sales',
  '##User.LastName##': 'Rep',
};
const IGNORES = ['__MACOSX', '.DS_Store', 'Thumbs.db'];
const ASSET_EXT = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.css',
  '.js',
  '.mp4',
  '.mov',
  '.m4v',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.pdf',
]);

function webPathPrefixNorm(p?: string): string {
  if (!p?.trim()) return '';
  return p.replace(/\/+$/, '') || '';
}

/** Browser URL root for this preview's output files (e.g. `/outputs/id` or `/api/veeva-suite/outputs/id`). */
export function outputsRoot(webPrefix: string, id: string): string {
  const p = webPathPrefixNorm(webPrefix);
  return p ? `${p}/outputs/${id}` : `/outputs/${id}`;
}

export function suiteDownloadHref(webPrefix: string, id: string): string {
  const p = webPathPrefixNorm(webPrefix);
  return p ? `${p}/suite-runs/${id}/download` : `/api/suite-runs/${id}/download`;
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'unit';
}
function ignored(s: string) {
  return IGNORES.some((i) => s.includes(i)) || path.basename(s).startsWith('._');
}
async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
async function readText(p: string) {
  return (await fs.readFile(p, 'utf8')).replace(/^\uFEFF/, '');
}
async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (ignored(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}
async function copyDir(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true });
  for (const e of await fs.readdir(src, { withFileTypes: true })) {
    if (ignored(e.name)) continue;
    const s = path.join(src, e.name),
      d = path.join(dest, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}
async function safeExtract(zipPath: string, dest: string) {
  await fs.mkdir(dest, { recursive: true });
  const zip = new AdmZip(zipPath);
  for (const ent of zip.getEntries()) {
    if (ent.isDirectory || ignored(ent.entryName)) continue;
    const normalized = path.normalize(ent.entryName).replace(/^([/\\])+/, '');
    if (normalized.startsWith('..')) throw new Error(`Unsafe ZIP path rejected: ${ent.entryName}`);
    const out = path.join(dest, normalized);
    if (!out.startsWith(dest)) throw new Error(`Unsafe ZIP path rejected: ${ent.entryName}`);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, ent.getData());
  }
}

/** One code path: clear work dir, extract ZIP, walk HTML, classify RTE vs CLM, resolve shell + RTE fragment list. Used by token scan and full assembly so they cannot drift. */
type VeevaZipIntake = {
  htmlFiles: string[];
  htmlByFile: Map<string, string>;
  packageType: PackageType;
  shellPath: string;
  fragFiles: string[];
};

async function intakeVeevaZipFromPath(sourceZipPath: string, workRoot: string): Promise<VeevaZipIntake> {
  await fs.rm(workRoot, { recursive: true, force: true });
  await fs.mkdir(workRoot, { recursive: true });
  await safeExtract(sourceZipPath, workRoot);
  const files = await walk(workRoot);
  const htmlFiles = files.filter((f) => /\.html?$/i.test(f));
  if (!htmlFiles.length) {
    return { htmlFiles: [], htmlByFile: new Map(), packageType: 'unknown', shellPath: '', fragFiles: [] };
  }
  const htmlByFile = new Map<string, string>();
  for (const f of htmlFiles) htmlByFile.set(f, await readText(f));
  const packageType = detectPackage(workRoot, htmlFiles, htmlByFile);
  const shellPath = findShell(workRoot, htmlFiles, htmlByFile);
  const fragFiles = htmlFiles.filter(
    (f) => path.relative(workRoot, f).replace(/\\/g, '/').toLowerCase().includes('fragments/') && f !== shellPath,
  );
  return { htmlFiles, htmlByFile, packageType, shellPath, fragFiles };
}
/**
 * RTE fragment files are often full mini-documents with layout CSS in `<head>`.
 * Assembly used to inject only `body` markup, so shell `<head>` rules won the cascade and broke
 * two-column / width-sensitive fragment tables. Callers should hoist `headStyleHtml` into the assembled
 * document `<head>` (after shell styles) while using `bodyHtml` as the slot payload.
 */
function extractRteFragmentParts(html: string): { bodyHtml: string; headStyleHtml: string } {
  const $ = cheerio.load(html);
  const styleParts: string[] = [];
  $('head style').each((_, el) => {
    const h = $.html(el);
    if (h?.trim()) styleParts.push(h);
  });
  const bodyHtml = $('body').length ? $('body').html() || '' : html;
  return { bodyHtml, headStyleHtml: styleParts.join('\n') };
}

function extractBody(html: string) {
  return extractRteFragmentParts(html).bodyHtml;
}

function injectBeforeHeadClose(html: string, insertion: string): string {
  const t = insertion.trim();
  if (!t) return html;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `\n${t}\n</head>`);
  }
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (open) => `${open}\n${t}\n`);
  }
  if (/<html\b[^>]*>/i.test(html)) {
    return html.replace(/<html\b[^>]*>/i, (m) => `${m}<head>\n${t}\n</head>`);
  }
  return `<!DOCTYPE html><html><head>\n${t}\n</head><body>${html}</body></html>`;
}
function htmlTitle(html: string, fallback: string) {
  const $ = cheerio.load(html);
  return ($('title').first().text() || $('h1').first().text() || fallback).replace(/\s+/g, ' ').trim().slice(0, 80) || fallback;
}
function escapeHtml(v: string) {
  return v.replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]!));
}
import {
  applyTokenReplacements,
  highlightUnmappedTokensYellow,
  highlightVeevaTokensMagenta,
  prepareFragmentForTokenPreview,
  replaceTokensPlain,
  stripPreviewTokenHighlights,
  TOKEN_FRAGMENT_FRAME_CSS,
} from './rte-token-html.js';

export {
  highlightVeevaTokensMagenta,
  prepareFragmentForTokenPreview,
  replaceTokensPlain,
  stripPreviewTokenHighlights,
  wrapFragmentWithMagentaBrackets,
} from './rte-token-html.js';

function replaceTokens(html: string, tokenMap: TokenMap) {
  return highlightUnmappedTokensYellow(applyTokenReplacements(html, tokenMap));
}
function findTokens(html: string, source: InventoryItem['source'], unitName?: string): InventoryItem[] {
  const set = new Set<string>();
  for (const m of html.matchAll(/\{\{[^}]+\}\}|##[^#]+##/g)) set.add(m[0]);
  return [...set].map((value) => ({
    type: 'token' as const,
    value,
    source,
    unitName,
    status: 'warning' as const,
    message: 'Runtime token detected. Mock or verify in Veeva.',
  }));
}
function collectInventory(html: string, source: InventoryItem['source'], unitName?: string): InventoryItem[] {
  const $ = cheerio.load(html);
  const items: InventoryItem[] = [];
  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    const label = $(el).text().replace(/\s+/g, ' ').trim().slice(0, 120) || undefined;
    const bad = !href || href === '#' || href.startsWith('{{');
    items.push({
      type: 'link',
      value: href || '[missing href]',
      label,
      source,
      unitName,
      status: bad ? 'warning' : 'ok',
      message: bad ? 'Placeholder or missing link.' : undefined,
    });
  });
  $('img').each((_, el) => {
    const src = ($(el).attr('src') || '').trim();
    const alt = ($(el).attr('alt') || '').trim();
    items.push({
      type: 'image',
      value: src || '[missing src]',
      label: alt || undefined,
      source,
      unitName,
      status: !src || !alt ? 'warning' : 'ok',
      message: !src ? 'Image source missing.' : !alt ? 'Image alt text missing.' : undefined,
    });
  });
  $('script[src],script').each((_, el) => {
    const src = ($(el).attr('src') || 'inline-script').trim();
    items.push({ type: 'script', value: src, source, unitName, status: 'ok' });
  });
  $('video source, video').each((_, el) => {
    const src = ($(el).attr('src') || 'embedded-video').trim();
    items.push({
      type: 'video',
      value: src,
      source,
      unitName,
      status: src ? 'ok' : 'warning',
      message: src ? undefined : 'Video source missing.',
    });
  });
  const apiSet = new Set<string>();
  for (const m of html.matchAll(
    /(?:com\.veeva\.clm|veeva|gotoSlide|launchApprovedEmail|trackEvent|createRecord|queryRecord|updateRecord|newRecord|saveObject)\b[\w.()]*/gi,
  ))
    apiSet.add(m[0]);
  for (const value of apiSet)
    items.push({
      type: 'veeva-api',
      value,
      source,
      unitName,
      status: 'warning',
      message: 'Veeva CLM runtime/API call detected and mocked for local preview.',
    });
  items.push(...findTokens(html, source, unitName));
  return items;
}
function group(items: InventoryItem[], type: InventoryItem['type']) {
  return items.filter((i) => i.type === type);
}
function detectPackage(root: string, htmlFiles: string[], htmlByFile: Map<string, string>): PackageType {
  const rels = htmlFiles.map((f) => path.relative(root, f).replace(/\\/g, '/').toLowerCase());
  const all = [...htmlByFile.values()].join('\n').toLowerCase();
  if (rels.some((r) => r.includes('fragments/')) || all.includes('{{insertemailfragments}}')) return 'rte';
  if (
    all.includes('com.veeva.clm') ||
    all.includes('gotoslide') ||
    rels.some((r) => /key[_-]?messages?|slides?|clm/.test(r)) ||
    htmlFiles.length > 1
  )
    return 'clm';
  return 'unknown';
}
function findShell(root: string, htmlFiles: string[], htmlByFile: Map<string, string>) {
  const direct = path.join(root, 'index.html');
  if (htmlFiles.includes(direct)) return direct;
  const withMarker = htmlFiles.find((f) => htmlByFile.get(f)?.includes('{{insertEmailFragments}}'));
  if (withMarker) return withMarker;
  return htmlFiles.sort((a, b) => a.length - b.length)[0];
}
async function copyRteAssets(root: string, outDir: string) {
  const assets = path.join(outDir, 'assets', 'images');
  await fs.mkdir(assets, { recursive: true });
  let count = 0;
  const files = await walk(root);
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) {
      await fs.copyFile(f, path.join(assets, path.basename(f)));
      count++;
    }
    if (path.basename(f).toLowerCase() === 'images.zip') {
      const z = new AdmZip(f);
      for (const ent of z.getEntries()) {
        if (ent.isDirectory || ignored(ent.entryName)) continue;
        await fs.writeFile(path.join(assets, path.basename(ent.entryName)), ent.getData());
        count++;
      }
    }
  }
  return count;
}
function fixRteAssetPaths(html: string, id: string, webPrefix: string) {
  const root = outputsRoot(webPrefix, id);
  const $ = cheerio.load(html);
  const rewrite = (v?: string) => {
    if (!v || /^https?:|^data:|^cid:|^mailto:|^tel:/i.test(v) || v.startsWith('#')) return v;
    return `${root}/assets/images/${path.basename(v.split('?')[0])}`;
  };
  $('[src]').each((_, el) => {
    $(el).attr('src', rewrite($(el).attr('src')));
  });
  $('[background]').each((_, el) => {
    $(el).attr('background', rewrite($(el).attr('background')));
  });
  $('[style]').each((_, el) => {
    $(el).attr(
      'style',
      ($(el).attr('style') || '').replace(/url\((['"]?)([^)'"}]+)\1\)/g, (_m, q, a) => `url(${q}${rewrite(a)}${q})`),
    );
  });
  return $.html();
}
/** Veeva RTE token for shell insertion (case-insensitive, flexible inner spaces). */
const INSERT_EMAIL_FRAGMENTS_RE = /\{\{\s*insertEmailFragments\s*\}\}/gi;
const INSERT_EMAIL_FRAGMENTS_ONCE_RE = /\{\{\s*insertEmailFragments\s*\}\}/i;

/**
 * Prefer `data-rte-fragments` (or legacy markers) on the single `td` that must contain all fragment
 * tables. `{{insertEmailFragments}}` is supported via DOM splice (not string replace) so multiple
 * `<table>` roots stay inside the intended cell and the wrapper/footer tree stays valid.
 */
export function injectFragments(shell: string, fragHtml: string, warnings: AssemblyWarning[]) {
  const $markerPass = cheerio.load(shell);
  const marker = $markerPass('*[data-rte-fragments],*[data-fragments],#fragments,.fragments').first();
  if (marker.length) {
    marker.html(fragHtml);
    return $markerPass.html();
  }

  const tokenMatches = shell.match(INSERT_EMAIL_FRAGMENTS_RE) ?? [];
  if (tokenMatches.length === 0) {
    warnings.push({
      severity: 'error',
      code: 'NO_FRAGMENT_SLOT',
      message:
        'RTE shell has no fragment slot: add {{insertEmailFragments}} or an element with data-rte-fragments (or data-fragments / #fragments / .fragments).',
    });
    throw new Error(
      'RTE assembly failed: no fragment placeholder. Expected {{insertEmailFragments}} or data-rte-fragments marker.',
    );
  }
  if (tokenMatches.length > 1) {
    warnings.push({
      severity: 'error',
      code: 'DUPLICATE_INSERT_EMAIL_FRAGMENTS',
      message: `RTE shell contains ${tokenMatches.length} occurrences of {{insertEmailFragments}}; exactly one is required.`,
    });
    throw new Error('RTE assembly failed: {{insertEmailFragments}} must appear exactly once in the shell.');
  }

  const spliceId = `rte-frag-splice-${crypto.randomUUID()}`;
  const sentinel = `<span data-rte-frag-splice="${spliceId}"></span>`;
  const shellWithSentinel = shell.replace(INSERT_EMAIL_FRAGMENTS_ONCE_RE, sentinel);

  const $ = cheerio.load(shellWithSentinel);
  const slot = $(`[data-rte-frag-splice="${spliceId}"]`).first();
  if (!slot.length) {
    throw new Error(
      'RTE assembly failed: could not locate fragment splice point after token replacement (shell may contain invalid HTML).',
    );
  }

  const parsed = cheerio.load(fragHtml, undefined, false);
  const nodes = parsed.root().children().toArray();
  slot.replaceWith(nodes);

  return $.html();
}

/**
 * Fail assembly if a Blueprint-style footer exists but is not under `table.wrapper` (broken table tree).
 */
export function assertRteAssembledStructure(html: string): void {
  const $ = cheerio.load(html);
  const footer = $('table[bgcolor="#181153"]').first();
  if (!footer.length) return;
  const wrapper = $('table.wrapper').first();
  if (!wrapper.length) {
    throw new Error(
      'RTE assembly validation failed: found table[bgcolor="#181153"] but no table.wrapper in assembled HTML.',
    );
  }
  if (!footer.closest('table.wrapper').length) {
    throw new Error(
      'RTE assembly validation failed: footer table must be nested inside table.wrapper (fragment injection corrupts the table tree).',
    );
  }
}
function makeUnitPreview(title: string, body: string, type: 'fragment' | 'slide', fragmentHeadStyles?: string) {
  const chrome = `<meta charset="utf-8"><meta name="color-scheme" content="light"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>html{color-scheme:only light}body{margin:0;background:#eef1f5;padding:24px;font-family:Arial,sans-serif;color:#111827}.wrap{max-width:${type === 'slide' ? '1024' : '600'}px;margin:0 auto;background:#fff;border:1px solid #d1d5db;min-height:${type === 'slide' ? '640' : 'auto'}px}</style>`;
  const extra = (fragmentHeadStyles || '').trim();
  return `<!doctype html><html><head>${chrome}${extra ? `\n${extra}\n` : ''}</head><body><div class="wrap">${body}</div></body></html>`;
}
function veevaClmMockScript() {
  return `<script>window.__RAGTAG_CLM_MOCK__=true;(function(){const log=(name,args)=>{console.info('[RagTag Veeva CLM mock]',name,args||[]);};function done(cb,payload){try{if(typeof cb==='function')cb(payload||{success:true});}catch(e){}};window.com=window.com||{};com.veeva=com.veeva||{};com.veeva.clm=com.veeva.clm||{};const clm=com.veeva.clm;['gotoSlide','gotoSlideV2','nextSlide','prevSlide','launchApprovedEmail','trackEvent','createRecord','queryRecord','updateRecord','newRecord','saveObject','getDataForCurrentObject','getDataForObject'].forEach(function(name){clm[name]=clm[name]||function(){log(name,Array.from(arguments));done(arguments[arguments.length-1],{success:true,mock:true});};});window.gotoSlide=window.gotoSlide||function(){log('gotoSlide',Array.from(arguments));};})();</script>`;
}
function injectClmRuntime(html: string) {
  if (html.includes('__RAGTAG_CLM_MOCK__')) return html;
  const script = veevaClmMockScript();
  if (html.includes('</head>')) return html.replace('</head>', `${script}</head>`);
  if (html.includes('<body')) return html.replace(/<body([^>]*)>/i, `<body$1>${script}`);
  return `${script}${html}`;
}

const PREVIEW_COLOR_SCHEME_STYLE_HTML = '<style>html{color-scheme:only light}</style>';

/** Remove `<meta name="viewport" …>` anywhere (head or body). Attribute order may vary. */
function stripAllViewportMetas(html: string): string {
  return html.replace(/<meta\b[^>]*>/gi, (tag) => {
    if (/\bname\s*=\s*["']?\s*viewport\s*["']?/i.test(tag)) return '';
    return tag;
  });
}

/**
 * Prepare `assembled-email.html` for iframe preview without re-parsing the whole document in Cheerio
 * (serialization can mutate table-based email HTML). Strip all viewport metas and do not inject a
 * replacement: the nested browsing context then uses the iframe's CSS width for layout, avoiding
 * `width=device-width` in a small iframe and avoiding `meta width=N` sitting exactly on `@media (max-width: Npx)`.
 * Still inject light `color-scheme` for dark host pages.
 */
function injectPreviewHeadIntoAssembledEmail(html: string): string {
  const t = html.trim();
  const headPack = `<meta name="color-scheme" content="light">${PREVIEW_COLOR_SCHEME_STYLE_HTML}`;
  if (!/^<\s*!doctype/i.test(t) && !/^<\s*html/i.test(t)) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">${headPack}</head><body>${t}</body></html>`;
  }

  let out = stripAllViewportMetas(t);

  if (!/<html\b/i.test(out)) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">${headPack}</head><body>${out}</body></html>`;
  }

  const hasColorSchemeMeta = /<meta\b[^>]*\bname\s*=\s*["']?\s*color-scheme\s*["']?[^>]*>/i.test(out);
  const hasOnlyLightStyle = /color-scheme\s*:\s*only\s+light/i.test(out);
  const injectBits: string[] = [];
  if (!hasColorSchemeMeta) injectBits.push('<meta name="color-scheme" content="light">');
  if (!hasOnlyLightStyle) injectBits.push(PREVIEW_COLOR_SCHEME_STYLE_HTML);
  const pack = injectBits.join('');

  if (pack) {
    if (/<\/head>/i.test(out)) {
      out = out.replace(/<\/head>/i, `${pack}</head>`);
    } else if (/<head\b[^>]*>/i.test(out)) {
      out = out.replace(/<head\b[^>]*>/i, (m) => `${m}${pack}`);
    } else if (/<html\b[^>]*>/i.test(out)) {
      out = out.replace(/<html\b[^>]*>/i, (m) => `${m}<head>${pack}</head>`);
    } else {
      out = `<!DOCTYPE html><html><head><meta charset="utf-8">${pack}</head><body>${out}</body></html>`;
    }
  }

  return out;
}

function makeRtePreview(params: {
  webPathPrefix: string;
  id: string;
  sourceName: string;
  fragments: ReviewUnit[];
  warnings: AssemblyWarning[];
  inventory: InventoryItem[];
}) {
  const root = outputsRoot(params.webPathPrefix, params.id);
  const fl = params.fragments
    .map(
      (f, i) =>
        `<li><strong>${i + 1}</strong> <a href="${root}/${f.previewPath}">${escapeHtml(f.name)}</a></li>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RTE Email Preview</title><style>${basePreviewCss()}</style></head><body><div class="topbar"><h1>RTE Email Preview</h1><p>${escapeHtml(params.sourceName)} • ${params.fragments.length} fragments inserted</p></div><div class="layout"><aside class="panel"><h2>Inserted fragments</h2><ul>${fl}</ul>${warningBlock(params.warnings)}${links(params.id, params.webPathPrefix)}</aside><main class="framewrap"><iframe class="email-frame" title="Assembled email preview" src="${root}/assembled-email.html"></iframe></main></div></body></html>`;
}
function makeClmDeckPreview(params: {
  webPathPrefix: string;
  id: string;
  sourceName: string;
  slides: ReviewUnit[];
  warnings: AssemblyWarning[];
  inventory: InventoryItem[];
  navigation: { from: string; to: string; reason: string }[];
}) {
  const root = outputsRoot(params.webPathPrefix, params.id);
  const first = params.slides[0]?.previewPath || '';
  const options = params.slides
    .map((s, i) => `<option value="${root}/${s.previewPath}">${i + 1}. ${escapeHtml(s.name)}</option>`)
    .join('');
  const thumbs = params.slides
    .map(
      (s, i) =>
        `<li><button onclick="document.getElementById('slideFrame').src='${root}/${s.previewPath}';document.getElementById('slideSelect').value='${root}/${s.previewPath}'"><strong>${i + 1}</strong> ${escapeHtml(s.name)}</button></li>`,
    )
    .join('');
  const nav =
    params.navigation
      .slice(0, 30)
      .map((n) => `<li>${escapeHtml(n.from)} → ${escapeHtml(n.to)} <em>${escapeHtml(n.reason)}</em></li>`)
      .join('') || '<li>No explicit navigation calls detected.</li>';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CLM Deck Preview</title><style>${basePreviewCss()}button{background:none;border:0;text-align:left;cursor:pointer;color:#2563eb;padding:3px}select{width:100%;padding:8px;border-radius:8px;border:1px solid #d1d5db}.slide-frame{width:100%;height:760px;border:1px solid #d1d5db;border-radius:10px;background:white}</style></head><body><div class="topbar"><h1>CLM Deck Preview</h1><p>${escapeHtml(params.sourceName)} • ${params.slides.length} slides/key messages detected</p></div><div class="layout"><aside class="panel"><h2>Slide navigator</h2><select id="slideSelect" onchange="document.getElementById('slideFrame').src=this.value">${options}</select><ul>${thumbs}</ul><h2>Detected navigation</h2><ul>${nav}</ul>${warningBlock(params.warnings)}${links(params.id, params.webPathPrefix)}</aside><main class="framewrap"><iframe id="slideFrame" class="slide-frame" src="${root}/${first}"></iframe></main></div></body></html>`;
}
function basePreviewCss() {
  // Light color-scheme + explicit chrome colors: dashboard dark mode / UA dark styles can leak into iframes and ruin .btn contrast.
  // .email-frame: assembled email loads in iframe as a single valid document so Veeva <head> CSS applies.
  return [
    'html{color-scheme:only light}',
    'body{margin:0;background:#eef1f5;font-family:Arial,sans-serif;color:#111827}',
    '*,*::before,*::after{box-sizing:border-box}',
    '.topbar{position:sticky;top:0;z-index:10;background:#101827;color:#fff;padding:14px 20px;box-shadow:0 2px 12px rgba(0,0,0,.25)}',
    '.topbar h1{font-size:18px;margin:0 0 4px}',
    '.topbar p{font-size:12px;margin:0;color:#d1d5db}',
    '.layout{display:grid;grid-template-columns:330px 1fr;gap:20px;padding:20px;min-width:0}',
    '.panel{min-width:0;background-color:#fff;color:#111827;border-radius:14px;padding:16px;box-shadow:0 1px 8px rgba(0,0,0,.12);height:max-content;position:sticky;top:82px}',
    '.panel h2{font-size:14px;margin:14px 0 10px}',
    '.panel ul{margin:0;padding-left:18px;font-size:12px;line-height:1.45}',
    '.panel a:not(.btn){color:#1d4ed8}',
    '.framewrap{min-width:0;display:flex;flex-direction:column;align-items:stretch;background-color:#fff;color:#111827;border-radius:14px;padding:20px;box-shadow:0 1px 8px rgba(0,0,0,.12);overflow:auto}',
    '.email-frame{align-self:center;width:100%;max-width:1200px;min-height:640px;height:min(85vh,900px);border:1px solid #d1d5db;border-radius:10px;background:#fff;box-sizing:border-box}',
    '.btn,.btn:visited,.btn:hover,.btn:active{display:inline-block;margin:8px 6px 0 0;padding:8px 10px;background-color:#111827!important;color:#fff!important;-webkit-text-fill-color:#fff;border-radius:8px;text-decoration:none!important;font-size:12px;font-weight:600}',
    '.warning{background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:10px;margin:12px 0;font-size:12px;color:#111827}',
    '@media(max-width:900px){.layout{display:block}.panel{position:relative;top:0;margin-bottom:20px}}',
  ].join('');
}
function warningBlock(warnings: AssemblyWarning[]) {
  return warnings.length
    ? `<div class="warning"><strong>Warnings</strong><ul>${warnings.map((w) => `<li>${escapeHtml(w.message)}</li>`).join('')}</ul></div>`
    : '';
}
function links(id: string, webPrefix: string) {
  const root = outputsRoot(webPrefix, id);
  return `<a class="btn" href="${suiteDownloadHref(webPrefix, id)}">Download package</a><a class="btn" href="${root}/review-report.html">Review report</a><a class="btn" href="${root}/manifest.json">Manifest</a>`;
}
function navigationFromHtml(htmlBySlide: { name: string; html: string }[]) {
  const out: { from: string; to: string; reason: string }[] = [];
  for (const s of htmlBySlide) {
    for (const m of s.html.matchAll(/gotoSlide(?:V2)?\s*\(\s*['"]([^'"]+)['"]/gi)) out.push({ from: s.name, to: m[1], reason: 'gotoSlide call' });
    for (const m of s.html.matchAll(/href\s*=\s*['"]([^'"]+\.html?)['"]/gi)) out.push({ from: s.name, to: m[1], reason: 'HTML link' });
  }
  return out;
}
async function zipDirectory(sourceDir: string, outPath: string) {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  return new Promise<void>((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = createWriteStream(outPath);
    stream.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(stream);
    archive.glob('**/*', { cwd: sourceDir, ignore: ['veeva-suite-output.zip'] });
    archive.finalize();
  });
}

/** Wait for in-document `<img>` loads so screenshots are not taken with placeholders mid-fetch. */
async function settleDomImages(page: import('playwright').Page) {
  try {
    await page.evaluate(() =>
      Promise.all(
        Array.from(document.images).map(
          (img) =>
            img.complete
              ? Promise.resolve()
              : new Promise<void>((resolve) => {
                  const done = () => resolve();
                  img.addEventListener('load', done, { once: true });
                  img.addEventListener('error', done, { once: true });
                  setTimeout(done, 20000);
                }),
        ),
      ),
    );
  } catch {
    // ignore (navigation race, detached frame, etc.)
  }
}
function invRows(items: InventoryItem[], cols: (i: InventoryItem) => string) {
  return items.map(cols).join('') || '<tr><td colspan="5">None found.</td></tr>';
}
function makeReviewReport(result: AssemblyResult) {
  const warningRows =
    result.warnings.map((w) => `<tr><td>${escapeHtml(w.severity)}</td><td>${escapeHtml(w.code)}</td><td>${escapeHtml(w.message)}</td></tr>`).join('') ||
    '<tr><td colspan="3">No warnings generated.</td></tr>';
  const unitRows = [...result.fragments, ...result.slides]
    .map(
      (u, i) =>
        `<tr><td>${i + 1}</td><td>${escapeHtml(u.type || 'unit')}</td><td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.sourcePath)}</td><td>${u.htmlLength}</td></tr>`,
    )
    .join('');
  const navRows =
    result.navigation
      .map((n) => `<tr><td>${escapeHtml(n.from)}</td><td>${escapeHtml(n.to)}</td><td>${escapeHtml(n.reason)}</td></tr>`)
      .join('') || '<tr><td colspan="3">No explicit navigation detected.</td></tr>';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Veeva Review Report</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#111827}h1{font-size:26px;margin-bottom:4px}h2{font-size:18px;margin-top:30px;border-top:1px solid #d1d5db;padding-top:18px}.meta{color:#4b5563;margin-bottom:22px}.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}.card{border:1px solid #d1d5db;border-radius:12px;padding:12px}.num{font-size:24px;font-weight:700}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #d1d5db;padding:7px;text-align:left;vertical-align:top}th{background:#f3f4f6}.small{font-size:12px;color:#4b5563}</style></head><body><h1>${result.packageType.toUpperCase()} Review Report</h1><div class="meta">${escapeHtml(result.sourceName)} • Generated by RagTag Veeva Suite Engine</div><div class="cards"><div class="card"><div class="num">${result.fragmentCount}</div><div>Fragments</div></div><div class="card"><div class="num">${result.slideCount}</div><div>Slides</div></div><div class="card"><div class="num">${group(result.inventory, 'link').length}</div><div>Links</div></div><div class="card"><div class="num">${group(result.inventory, 'image').length}</div><div>Images</div></div><div class="card"><div class="num">${result.warnings.length}</div><div>Warnings</div></div></div><h2>Summary</h2><p>This report is generated from the uploaded Veeva package. RTE packages are assembled from shell + fragments. CLM packages are rendered as a local slide deck with a mocked Veeva CLM runtime.</p><h2>Warnings</h2><table><thead><tr><th>Severity</th><th>Code</th><th>Message</th></tr></thead><tbody>${warningRows}</tbody></table><h2>Review units</h2><table><thead><tr><th>#</th><th>Type</th><th>Name</th><th>Source path</th><th>HTML length</th></tr></thead><tbody>${unitRows}</tbody></table><h2>CLM navigation map</h2><table><thead><tr><th>From</th><th>To</th><th>Reason</th></tr></thead><tbody>${navRows}</tbody></table><h2>Link inventory</h2><table><thead><tr><th>Status</th><th>Source</th><th>Label</th><th>Href</th><th>Message</th></tr></thead><tbody>${invRows(group(result.inventory, 'link'), (i) => `<tr><td>${escapeHtml(i.status)}</td><td>${escapeHtml(i.unitName || i.source)}</td><td>${escapeHtml(i.label || '')}</td><td>${escapeHtml(i.value)}</td><td>${escapeHtml(i.message || '')}</td></tr>`)}</tbody></table><h2>Image inventory</h2><table><thead><tr><th>Status</th><th>Source</th><th>Alt</th><th>Src</th><th>Message</th></tr></thead><tbody>${invRows(group(result.inventory, 'image'), (i) => `<tr><td>${escapeHtml(i.status)}</td><td>${escapeHtml(i.unitName || i.source)}</td><td>${escapeHtml(i.label || '')}</td><td>${escapeHtml(i.value)}</td><td>${escapeHtml(i.message || '')}</td></tr>`)}</tbody></table><h2>Token + Veeva API inventory</h2><table><thead><tr><th>Type</th><th>Status</th><th>Source</th><th>Value</th><th>Message</th></tr></thead><tbody>${invRows(
    result.inventory.filter((i) => i.type === 'token' || i.type === 'veeva-api'),
    (i) =>
      `<tr><td>${escapeHtml(i.type)}</td><td>${escapeHtml(i.status)}</td><td>${escapeHtml(i.unitName || i.source)}</td><td>${escapeHtml(i.value)}</td><td>${escapeHtml(i.message || '')}</td></tr>`,
  )}</tbody></table><p class="small">This tool supports internal QA/review acceleration. It does not replace Veeva validation, MLR approval, or device-specific production QA.</p></body></html>`;
}
async function maybeScreenshots(result: AssemblyResult, publicBase?: string) {
  if (!publicBase) {
    result.warnings.push({
      severity: 'info',
      code: 'SCREENSHOTS_SKIPPED',
      message: 'Screenshots require PUBLIC_BASE_URL/API context.',
    });
    return;
  }
  try {
    const playwright = await import('playwright');
    const browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const shotDir = path.join(result.outputDir, 'screenshots');
    await fs.mkdir(shotDir, { recursive: true });
    // Full-page capture: assembled email only (RTE), not the dashboard-style rte-preview shell + iframe.
    const fullPageFile =
      result.packageType === 'rte' && result.assembledHtmlPath
        ? result.assembledHtmlPath
        : path.basename(result.previewHtmlPath);
    await page.goto(`${publicBase}/outputs/${result.id}/${fullPageFile}`, { waitUntil: 'networkidle' });
    await settleDomImages(page);
    await page.screenshot({ path: path.join(shotDir, 'full-preview.png'), fullPage: true });
    result.screenshots.fullPage = 'screenshots/full-preview.png';
    for (const u of [...result.fragments, ...result.slides]) {
      await page.goto(`${publicBase}/outputs/${result.id}/${u.previewPath}`, { waitUntil: 'networkidle' });
      await settleDomImages(page);
      const name = `${u.type || 'unit'}-${u.id}.png`;
      await page.screenshot({ path: path.join(shotDir, name), fullPage: true });
      if (u.type === 'slide') result.screenshots.slides.push(`screenshots/${name}`);
      else result.screenshots.fragments.push(`screenshots/${name}`);
      u.screenshotPath = `screenshots/${name}`;
    }
    const pdf = path.join(result.outputDir, 'review-report.pdf');
    await page.goto(`${publicBase}/outputs/${result.id}/review-report.html`, { waitUntil: 'networkidle' });
    await settleDomImages(page);
    await page.pdf({ path: pdf, format: 'Letter', printBackground: true });
    result.reportPdfPath = 'review-report.pdf';
    await browser.close();
  } catch (e) {
    result.warnings.push({
      severity: 'info',
      code: 'SCREENSHOTS_UNAVAILABLE',
      message: `Screenshot/PDF generation skipped: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
}

export type DiscoverRteTokensOptions = {
  sourceZipPath: string;
  workBaseDir: string;
};

/** Scan a ZIP for RTE shell + fragment HTML and return unique `{{...}}` / `##...##` literals (raw, before token replacement). */
export async function discoverRteTokensFromZip(options: DiscoverRteTokensOptions): Promise<{
  packageType: PackageType;
  tokens: string[];
}> {
  const id = crypto.randomUUID().slice(0, 8);
  const workRoot = path.join(options.workBaseDir, `token-scan-${id}`);
  try {
    const { htmlFiles, htmlByFile, packageType, shellPath, fragFiles } = await intakeVeevaZipFromPath(
      options.sourceZipPath,
      workRoot,
    );
    if (!htmlFiles.length) return { packageType: 'unknown', tokens: [] };
    if (packageType !== 'rte') return { packageType, tokens: [] };
    const set = new Set<string>();
    const gather = (html: string) => {
      for (const m of html.matchAll(/\{\{[^}]+\}\}|##[^#]+##/g)) {
        const t = m[0];
        if (/^\{\{\s*insertEmailFragments\s*\}\}$/i.test(t)) continue;
        set.add(t);
      }
    };
    gather(htmlByFile.get(shellPath)!);
    for (const f of fragFiles.sort()) gather(htmlByFile.get(f)!);
    const tokens = [...set].sort((a, b) => a.localeCompare(b));
    return { packageType, tokens };
  } finally {
    await fs.rm(workRoot, { recursive: true, force: true });
  }
}

export async function assembleVeevaZip(options: AssembleOptions): Promise<AssemblyResult> {
  const webPrefix = options.webPathPrefix ?? '';
  const id = crypto.randomUUID().slice(0, 8);
  const tokenMap = { ...DEFAULT_TOKENS, ...(options.tokenMap || {}) };
  const sourceName = path.basename(options.sourceZipPath);
  const workRoot = path.join(options.workBaseDir, id);
  const outputDir = path.join(options.outputBaseDir, id);
  await fs.rm(workRoot, { recursive: true, force: true });
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });
  const { htmlFiles, htmlByFile, packageType, shellPath, fragFiles } = await intakeVeevaZipFromPath(
    options.sourceZipPath,
    workRoot,
  );
  if (!htmlFiles.length) throw new Error('No HTML files found. This does not look like an RTE or CLM package.');
  const warnings: AssemblyWarning[] = [];
  const inventory: InventoryItem[] = [];
  const fragments: ReviewUnit[] = [];
  const slides: ReviewUnit[] = [];
  let previewName = 'veeva-suite.html';
  let assembledHtmlPath: string | undefined;
  const outRoot = outputsRoot(webPrefix, id);
  if (packageType === 'rte') {
    await copyRteAssets(workRoot, outputDir);
    if (!fragFiles.length)
      warnings.push({
        severity: 'warning',
        code: 'NO_FRAGMENTS_FOUND',
        message: 'RTE package detected, but no fragment HTML files were found.',
      });
    const fragBits: string[] = [];
    const fragBitsRaw: string[] = [];
    const fragBitsToken: string[] = [];
    const hoistedFragmentStyles: string[] = [];
    let idx = 0;
    for (const f of fragFiles.sort()) {
      const raw = htmlByFile.get(f)!;
      const name =
        path.basename(path.dirname(f)) === 'fragments' ? path.basename(f, path.extname(f)) : path.basename(path.dirname(f));
      const idu = slug(`${idx + 1}-${name}`);
      const { bodyHtml, headStyleHtml } = extractRteFragmentParts(raw);
      if (headStyleHtml.trim()) {
        hoistedFragmentStyles.push(`<!-- rte-fragment-styles:${escapeHtml(name)} -->\n${headStyleHtml}`);
      }
      const bodyRaw = fixRteAssetPaths(bodyHtml, id, webPrefix);
      const body = replaceTokens(bodyRaw, tokenMap);
      const previewPath = `fragments/${idu}.html`;
      await fs.mkdir(path.join(outputDir, 'fragments'), { recursive: true });
      await fs.writeFile(
        path.join(outputDir, previewPath),
        makeUnitPreview(name, body, 'fragment', headStyleHtml),
      );
      fragments.push({
        id: idu,
        name,
        sourcePath: path.relative(workRoot, f),
        previewPath,
        htmlLength: raw.length,
        imagesCopied: 0,
        type: 'fragment',
      });
      inventory.push(...collectInventory(raw, 'fragment', name));
      fragBitsRaw.push(`<!-- Fragment: ${escapeHtml(name)} -->\n${bodyRaw}`);
      fragBitsToken.push(
        `<!-- Fragment: ${escapeHtml(name)} -->\n${prepareFragmentForTokenPreview(bodyRaw)}`,
      );
      fragBits.push(`<!-- Fragment: ${escapeHtml(name)} -->\n${body}`);
      idx++;
    }
    const shellRaw = htmlByFile.get(shellPath)!;
    inventory.push(...collectInventory(shellRaw, 'shell'));
    let assembledRaw = fixRteAssetPaths(injectFragments(shellRaw, fragBitsRaw.join('\n'), warnings), id, webPrefix);
    assembledRaw = injectBeforeHeadClose(assembledRaw, hoistedFragmentStyles.join('\n'));
    assertRteAssembledStructure(assembledRaw);
    let assembledTokenRaw = fixRteAssetPaths(
      injectFragments(shellRaw, fragBitsToken.join('\n'), warnings),
      id,
      webPrefix,
    );
    assembledTokenRaw = injectBeforeHeadClose(
      assembledTokenRaw,
      `${hoistedFragmentStyles.join('\n')}\n<style>${TOKEN_FRAGMENT_FRAME_CSS}</style>`,
    );
    assertRteAssembledStructure(assembledTokenRaw);
    const assembled = replaceTokens(assembledRaw, tokenMap);
    assembledHtmlPath = 'assembled-email.html';
    await fs.writeFile(
      path.join(outputDir, assembledHtmlPath),
      injectPreviewHeadIntoAssembledEmail(highlightUnmappedTokensYellow(assembledRaw)),
    );
    await fs.writeFile(
      path.join(outputDir, 'assembled-email-processed.html'),
      injectPreviewHeadIntoAssembledEmail(replaceTokensPlain(assembledRaw, tokenMap)),
    );
    await fs.writeFile(
      path.join(outputDir, 'assembled-email-tokens.html'),
      injectPreviewHeadIntoAssembledEmail(highlightVeevaTokensMagenta(assembledTokenRaw)),
    );
    previewName = 'rte-preview.html';
    await fs.writeFile(
      path.join(outputDir, previewName),
      makeRtePreview({
        webPathPrefix: webPrefix,
        id,
        sourceName,
        fragments,
        warnings,
        inventory,
      }),
    );
    inventory.push(...collectInventory(assembled, 'assembled'));
  } else {
    if (packageType === 'unknown')
      warnings.push({
        severity: 'warning',
        code: 'UNKNOWN_PACKAGE_TYPE',
        message: 'Package did not clearly match RTE or CLM. It was treated as a CLM-style HTML deck.',
      });
    await copyDir(workRoot, path.join(outputDir, 'source'));
    const slideCandidates = htmlFiles
      .filter((f) => !path.relative(workRoot, f).toLowerCase().includes('preview') && !path.basename(f).startsWith('.'))
      .sort();
    const slideHtmls: { name: string; html: string }[] = [];
    let idx = 0;
    for (const f of slideCandidates) {
      const raw = htmlByFile.get(f)!;
      const rel = path.relative(workRoot, f).replace(/\\/g, '/');
      const title = htmlTitle(raw, path.basename(f, path.extname(f)));
      const name = title || rel;
      const idu = slug(`${idx + 1}-${name}`);
      const outRel = `slides/${idu}.html`;
      await fs.mkdir(path.join(outputDir, 'slides'), { recursive: true });
      const injected = injectClmRuntime(
        raw.replace(/(src|href)=(['"])(?!https?:|data:|mailto:|tel:|#)([^'"]+)\2/gi, (m, attr, q, val) => {
          const srcPath = `${outRoot}/source/${path.posix.normalize(path.posix.join(path.posix.dirname(rel), val))}`;
          return `${attr}=${q}${srcPath}${q}`;
        }),
      );
      await fs.writeFile(path.join(outputDir, outRel), injected);
      const dim = /1024|768|landscape/i.test(raw) ? 'Likely 1024x768 landscape' : 'Unknown';
      slides.push({
        id: idu,
        name,
        sourcePath: rel,
        previewPath: outRel,
        htmlLength: raw.length,
        dimensions: dim,
        type: 'slide',
      });
      inventory.push(...collectInventory(raw, 'slide', name));
      slideHtmls.push({ name, html: raw });
      idx++;
    }
    const navigation = navigationFromHtml(slideHtmls);
    previewName = 'clm-preview.html';
    await fs.writeFile(
      path.join(outputDir, previewName),
      makeClmDeckPreview({
        webPathPrefix: webPrefix,
        id,
        sourceName,
        slides,
        warnings,
        inventory,
        navigation,
      }),
    );
    const resultSkeleton: AssemblyResult = {
      id,
      packageType: packageType === 'unknown' ? 'unknown' : 'clm',
      sourceName,
      rootName: path.basename(workRoot),
      fragmentCount: 0,
      slideCount: slides.length,
      fragments,
      slides,
      warnings,
      inventory,
      navigation,
      outputDir,
      previewHtmlPath: previewName,
      reportHtmlPath: 'review-report.html',
      manifestPath: 'manifest.json',
      zipPath: 'veeva-suite-output.zip',
      screenshots: { fragments: [], slides: [] },
    };
    await fs.writeFile(path.join(outputDir, 'review-report.html'), makeReviewReport(resultSkeleton));
    await fs.writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(resultSkeleton, null, 2));
    if (options.enableScreenshots) await maybeScreenshots(resultSkeleton, options.publicOutputBaseUrl);
    await fs.writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(resultSkeleton, null, 2));
    await zipDirectory(outputDir, path.join(outputDir, 'veeva-suite-output.zip'));
    resultSkeleton.zipPath = 'veeva-suite-output.zip';
    return resultSkeleton;
  }
  const result: AssemblyResult = {
    id,
    packageType: 'rte',
    sourceName,
    rootName: path.basename(workRoot),
    fragmentCount: fragments.length,
    slideCount: 0,
    fragments,
    slides,
    warnings,
    inventory,
    navigation: [],
    outputDir,
    previewHtmlPath: previewName,
    assembledHtmlPath,
    reportHtmlPath: 'review-report.html',
    manifestPath: 'manifest.json',
    zipPath: 'veeva-suite-output.zip',
    screenshots: { fragments: [], slides: [] },
    tokenMap,
  };
  await fs.writeFile(path.join(outputDir, 'review-report.html'), makeReviewReport(result));
  await fs.writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(result, null, 2));
  if (options.enableScreenshots) await maybeScreenshots(result, options.publicOutputBaseUrl);
  await fs.writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(result, null, 2));
  await zipDirectory(outputDir, path.join(outputDir, 'veeva-suite-output.zip'));
  result.zipPath = 'veeva-suite-output.zip';
  return result;
}

export const assembleRteZip = assembleVeevaZip;

export {
  generateSubmissionPdf,
  buildSubmissionPageCount,
  computeFitScale,
  SUBMISSION_PAGE_COUNT,
} from './submission-pdf.js';
export type {
  CaptureHeader,
  GenerateSubmissionPdfOptions,
  GenerateSubmissionPdfResult,
  SubmissionPreviewMode,
} from './submission-pdf.js';

/** Re-pack output folder into veeva-suite-output.zip after late artifacts (e.g. submission PDF). */
export async function refreshSuiteOutputZip(outputDir: string) {
  await zipDirectory(outputDir, path.join(outputDir, 'veeva-suite-output.zip'));
}
