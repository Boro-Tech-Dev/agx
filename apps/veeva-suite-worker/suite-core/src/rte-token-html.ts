import * as cheerio from 'cheerio';
import type { AnyNode, Element, Text } from 'domhandler';
export type TokenMap = Record<string, string>;

function escapeHtml(v: string) {
  return v.replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]!));
}

const TOKEN_HIGHLIGHT_STYLE = 'background:#fff3cd;color:#7a4b00;padding:0 3px;border-radius:3px';
const TOKEN_MAGENTA_STYLE = 'color:#c800c8;font-weight:600';
const TOKEN_IN_TEXT_RE = /\{\{[^}]+\}\}|##[^#]+##/g;
const BRACKET_PLACEHOLDER_RE = /\[[^\]]{1,240}\]/g;
const SKIP_TOKEN_HIGHLIGHT_PARENT = new Set(['script', 'style', 'textarea', 'noscript', 'title', 'xmp']);
const MAGENTA_BORDER = '#c800c8';

function collectTextNodes($: cheerio.CheerioAPI, root: cheerio.Cheerio<AnyNode>): Text[] {
  const textNodes: Text[] = [];
  root
    .find('*')
    .addBack()
    .each((_, el) => {
      $(el)
        .contents()
        .each((__, node) => {
          if (node.type !== 'text' || !(node as Text).data) return;
          textNodes.push(node as Text);
        });
    });
  return textNodes;
}

function highlightPatternInTextNodesOnly(html: string, pattern: RegExp, spanStyle: string): string {
  const $ = cheerio.load(html);
  const body = $('body');
  const root = body.length ? body : $.root();
  const textNodes: Text[] = [];
  for (const node of collectTextNodes($, root)) {
    const data = node.data;
    if (!data) continue;
    pattern.lastIndex = 0;
    if (!pattern.test(data)) continue;
    const parent = node.parent as Element | undefined;
    const pname = parent?.type === 'tag' ? parent.name : '';
    if (pname && SKIP_TOKEN_HIGHLIGHT_PARENT.has(pname)) continue;
    textNodes.push(node);
  }

  for (const node of textNodes) {
    const data = node.data;
    if (!data) continue;
    let out = '';
    let last = 0;
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(data)) !== null) {
      out += data.slice(last, m.index);
      out += `<span style="${spanStyle}">${escapeHtml(m[0])}</span>`;
      last = m.index + m[0].length;
    }
    out += data.slice(last);
    $(node).replaceWith(out);
  }

  return $.html();
}

function highlightTokensInTextNodesOnly(html: string, spanStyle: string): string {
  return highlightPatternInTextNodesOnly(html, TOKEN_IN_TEXT_RE, spanStyle);
}

export function highlightUnmappedTokensYellow(html: string): string {
  return highlightTokensInTextNodesOnly(html, TOKEN_HIGHLIGHT_STYLE);
}

export function highlightVeevaTokensMagenta(html: string): string {
  return highlightTokensInTextNodesOnly(html, TOKEN_MAGENTA_STYLE);
}

/** Magenta `[placeholder]` copy in fragment resource blocks (text nodes only). */
export function highlightBracketPlaceholdersMagenta(html: string): string {
  return highlightPatternInTextNodesOnly(html, BRACKET_PLACEHOLDER_RE, TOKEN_MAGENTA_STYLE);
}

/** Email-safe L-brackets around a single fragment body (tokens preview). */
export function wrapFragmentWithMagentaBrackets(fragmentHtml: string): string {
  const inner = fragmentHtml.trim();
  if (!inner) return inner;
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="rte-frag-frame" style="margin:14px 0;">` +
    `<tr>` +
    `<td width="16" style="border-left:2px solid ${MAGENTA_BORDER};border-top:2px solid ${MAGENTA_BORDER};border-bottom:2px solid ${MAGENTA_BORDER};font-size:0;line-height:0;">&#8203;</td>` +
    `<td style="padding:10px 12px;vertical-align:top;">${inner}</td>` +
    `<td width="16" style="border-right:2px solid ${MAGENTA_BORDER};border-top:2px solid ${MAGENTA_BORDER};border-bottom:2px solid ${MAGENTA_BORDER};font-size:0;line-height:0;">&#8203;</td>` +
    `</tr></table>`
  );
}

export function prepareFragmentForTokenPreview(fragmentHtml: string): string {
  return wrapFragmentWithMagentaBrackets(highlightBracketPlaceholdersMagenta(fragmentHtml));
}

export const TOKEN_FRAGMENT_FRAME_CSS =
  '.rte-frag-frame td{border-color:#c800c8}';

export function applyTokenReplacements(html: string, tokenMap: TokenMap): string {
  let o = html;
  for (const [k, v] of Object.entries(tokenMap)) o = o.split(k).join(escapeHtml(v));
  return o.replace(/\{\{customText\[([^\]]+)\]\}\}/g, (_, c) => escapeHtml(c.split('|')[0] || ''));
}

export function replaceTokensPlain(html: string, tokenMap: TokenMap): string {
  return applyTokenReplacements(html, tokenMap);
}

export function stripPreviewTokenHighlights(html: string): string {
  const $ = cheerio.load(html);
  $('span[style*="fff3cd"]').each((_, el) => {
    const t = $(el).text();
    $(el).replaceWith(t);
  });
  return $.html();
}
