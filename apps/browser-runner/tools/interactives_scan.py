"""Collect visible interactive elements via ``page.evaluate`` (capped, best-effort hints)."""

from __future__ import annotations

import os
from typing import Any

from playwright.async_api import Page

INTERACTIVES_MAX_DEFAULT = 120
INTERACTIVES_TEXT_MAX_DEFAULT = 120
INTERACTIVES_HARD_MAX = 500

# Single evaluate script: args [maxItems, textMax, includeBbox]
_INTERACTIVES_SCAN_JS = """
([maxItems, textMax, includeBbox]) => {
  const MAX = Math.min(Math.max(1, maxItems | 0), 500);
  const TMAX = Math.min(Math.max(8, textMax | 0), 500);
  const wantBox = !!includeBbox;

  function isAriaHiddenChain(el) {
    let n = el;
    while (n && n.nodeType === 1) {
      if (n.getAttribute && n.getAttribute('aria-hidden') === 'true') return true;
      n = n.parentElement;
    }
    return false;
  }

  function isVisible(el) {
    if (!el || el.nodeType !== 1) return false;
    const st = window.getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 && r.height < 1) return false;
    return true;
  }

  function visibleText(el) {
    let t = (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ');
    if (t.length > TMAX) t = t.slice(0, TMAX);
    return t;
  }

  function hintFor(el) {
    const tag = el.tagName ? el.tagName.toLowerCase() : 'node';
    if (tag === 'summary') {
      const d = el.closest('details');
      if (d && d.id) {
        try {
          const idEsc = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(d.id) : String(d.id).replace(/"/g, '');
          return 'details#' + idEsc + ' > summary';
        } catch (e) {
          return 'details > summary';
        }
      }
      return 'details > summary';
    }
    if (el.id) {
      try {
        const idEsc = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(el.id) : String(el.id).replace(/"/g, '');
        return tag + '#' + idEsc;
      } catch (e) {
        return tag + '#id';
      }
    }
    const role = el.getAttribute('role');
    const nm = (el.getAttribute('name') || '').trim().slice(0, 40);
    if (role && nm) return tag + `[role="${role}"][name*="${nm.slice(0, 20)}"]`;
    if (role) return tag + `[role="${role}"]`;
    if (nm) return tag + `[name="${nm}"]`;
    return tag;
  }

  function bboxFor(el) {
    if (!wantBox) return undefined;
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.left + window.scrollX),
      y: Math.round(r.top + window.scrollY),
      w: Math.round(r.width),
      h: Math.round(r.height),
    };
  }

  const seen = new Set();
  const items = [];
  let truncated = false;

  function pushItem(el, kind, roleAttr) {
    if (seen.has(el)) return;
    if (!isVisible(el)) return;
    if (isAriaHiddenChain(el)) return;
    if (el.disabled) return;
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (tag === 'input') {
      const it = (el.type || 'text').toLowerCase();
      if (it === 'hidden') return;
    }
    seen.add(el);
    if (items.length >= MAX) {
      truncated = true;
      return;
    }

    const rrole = roleAttr || el.getAttribute('role');
    let inputType = null;
    let href = null;
    let text = '';
    const ariaRaw = (el.getAttribute('aria-label') || '').trim();
    const ariaLabel = ariaRaw.length > 120 ? ariaRaw.slice(0, 120) : ariaRaw;

    if (tag === 'a' && el.href) href = String(el.href).slice(0, 500);
    if (tag === 'input') {
      inputType = (el.type || 'text').toLowerCase();
      if (inputType === 'password') {
        text = '';
      } else if (['text', 'email', 'search', 'tel', 'url', 'number'].indexOf(inputType) >= 0) {
        const v = String(el.value || '').trim();
        text = v.length > TMAX ? v.slice(0, TMAX) : v;
      } else {
        text = visibleText(el);
      }
    } else {
      text = visibleText(el);
    }

    let role =
      rrole ||
      (tag === 'button' ? 'button' : null) ||
      (tag === 'a' ? 'link' : null) ||
      (tag === 'input' ? 'textbox' : null) ||
      (tag === 'select' ? 'combobox' : null) ||
      (tag === 'textarea' ? 'textbox' : null) ||
      'generic';

    const row = {
      kind: kind,
      role: role,
      text: text,
      href: href || undefined,
      selector_hint: hintFor(el),
      input_type: inputType || undefined,
      aria_label: ariaLabel || undefined,
    };
    const b = bboxFor(el);
    if (b) row.bbox = b;
    items.push(row);
  }

  const sel =
    'button, a[href], input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"]';
  const nodes = document.querySelectorAll(sel);
  for (const el of nodes) {
    if (items.length >= MAX) {
      truncated = true;
      break;
    }
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    const r = el.getAttribute('role');
    let kind = 'control';
    if (r === 'tab') kind = 'tab';
    else if (el.hasAttribute('aria-expanded')) kind = 'toggle';
    else if (tag === 'button' || r === 'button') kind = 'button';
    else if (tag === 'a' || r === 'link') kind = 'link';
    else if (tag === 'input') kind = 'input';
    else if (tag === 'select') kind = 'select';
    else if (tag === 'textarea') kind = 'textarea';
    else if (r === 'menuitem') kind = 'menuitem';
    pushItem(el, kind, r);
  }

  const sumNodes = document.querySelectorAll('details > summary');
  for (const el of sumNodes) {
    if (items.length >= MAX) {
      truncated = true;
      break;
    }
    pushItem(el, 'disclosure', null);
  }

  return { items, truncated };
}
"""


def _env_int(name: str, default: int, hard_max: int) -> int:
    raw = os.getenv(name, '').strip()
    if not raw:
        return default
    try:
        v = int(raw, 10)
    except ValueError:
        return default
    return max(1, min(v, hard_max))


def _env_bool(name: str) -> bool:
    return os.getenv(name, '').strip().lower() in ('1', 'true', 'yes', 'on')


async def collect_interactives(page: Page) -> dict[str, Any]:
    """
    Return ``{"items": [...], "truncated": bool}`` after in-page scan.
    Caps are enforced in JS and re-checked here (``WEB_INTERACTIVES_MAX``, default 120).
    """
    max_items = _env_int('WEB_INTERACTIVES_MAX', INTERACTIVES_MAX_DEFAULT, INTERACTIVES_HARD_MAX)
    text_max = _env_int(
        'WEB_INTERACTIVES_TEXT_MAX',
        INTERACTIVES_TEXT_MAX_DEFAULT,
        INTERACTIVES_HARD_MAX,
    )
    include_bbox = _env_bool('WEB_INTERACTIVES_INCLUDE_BBOX')

    raw = await page.evaluate(_INTERACTIVES_SCAN_JS, [max_items, text_max, include_bbox])
    if not isinstance(raw, dict):
        return {'items': [], 'truncated': False}

    items_in = raw.get('items')
    if not isinstance(items_in, list):
        items_in = []

    truncated = bool(raw.get('truncated'))
    out_items: list[dict[str, Any]] = []

    for it in items_in:
        if len(out_items) >= max_items:
            truncated = True
            break
        if not isinstance(it, dict):
            continue
        kind = str(it.get('kind', 'control'))[:64]
        role = str(it.get('role', 'generic'))[:64]
        text = str(it.get('text', ''))[:text_max]
        hint = str(it.get('selector_hint', ''))[:240]
        href = it.get('href')
        href_s = str(href)[:500] if href else None
        input_type = it.get('input_type')
        itype = str(input_type)[:32].lower() if input_type else None
        if itype == 'password':
            text = ''
        aria = it.get('aria_label')
        aria_s = str(aria)[:120] if aria else None

        row: dict[str, Any] = {
            'kind': kind,
            'role': role,
            'text': text,
            'selector_hint': hint,
        }
        if href_s:
            row['href'] = href_s
        if itype:
            row['input_type'] = itype
        if aria_s:
            row['aria_label'] = aria_s
        bbox = it.get('bbox')
        if include_bbox and isinstance(bbox, dict):
            row['bbox'] = {
                'x': int(bbox.get('x', 0)),
                'y': int(bbox.get('y', 0)),
                'w': int(bbox.get('w', 0)),
                'h': int(bbox.get('h', 0)),
            }
        out_items.append(row)

    if len(items_in) > max_items:
        truncated = True

    return {'items': out_items, 'truncated': truncated}
