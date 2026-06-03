'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { PanelChevron } from '../workspaces/PanelChevron';
import {
  getWebCaptureHealth,
  postWebCrawl,
  postWebExtract,
  postWebScreenshot,
  tryPostWebCrawlStream,
  uploadProjectDocument,
  WebCaptureError,
  WEB_INTERACTION_SELECTOR_MAX_LEN,
  type WebCaptureFailureDebug,
  type WebCrawlResponse,
  type WebExtractResponse,
  type WebInteractiveItem,
  type WebInteractionPlanStep,
  type WebScreenshotResponse,
  type WebStagingOptions,
} from '../../lib/api';
import { base64ToBlob, downloadBase64File, objectUrlFromBase64 } from '../../lib/downloadBase64';

type Mode = 'screenshot' | 'extract' | 'crawl';

function stripScreenshotForState(res: WebScreenshotResponse): WebScreenshotResponse {
  return { ...res, image_base64: '' };
}

function stripCrawlForState(res: WebCrawlResponse): WebCrawlResponse {
  return {
    ...res,
    pages: res.pages.map((page) => {
      const { pdf_base64: _pdf, ...rest } = page;
      return rest;
    }),
  };
}

function crawlPagePdfFilename(page: { url: string; title?: string }, index: number): string {
  const base = (page.title || page.url || `page-${index}`)
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 48);
  return `web-crawl-page-${index + 1}-${base || 'page'}.pdf`;
}
type WaitUntil = 'load' | 'domcontentloaded' | 'networkidle';

function stampSlug(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function parseExtraSelectors(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 24);
}

/** Playwright selector for interaction-plan clicks from crawl inventory hints. */
function selectorFromInventoryItem(it: WebInteractiveItem): string {
  const hint = (it.selector_hint || '').trim();
  if (hint.includes('#') || hint.includes('[')) {
    return hint.slice(0, WEB_INTERACTION_SELECTOR_MAX_LEN);
  }
  const label = (it.text || it.aria_label || '').trim();
  if (label) {
    return `text=${JSON.stringify(label)}`.slice(0, WEB_INTERACTION_SELECTOR_MAX_LEN);
  }
  return hint.slice(0, WEB_INTERACTION_SELECTOR_MAX_LEN) || 'button';
}

/** Elapsed seconds → m:ss or h:mm:ss for live run indicators. */
function formatElapsed(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** Screenshot / extract allowed only after a crawl with ≥1 successful page and same origin as URL. */
function crawlUnlocksCapture(crawl: WebCrawlResponse | null, urlTrimmed: string): boolean {
  if (!crawl?.pages?.length) return false;
  if (!crawl.pages.some((p) => !p.error)) return false;
  try {
    return new URL(urlTrimmed).origin === new URL(crawl.seed).origin;
  } catch {
    return false;
  }
}

function InteractivesDetails({
  items,
  serverTruncated,
}: {
  items: WebInteractiveItem[];
  serverTruncated?: boolean;
}) {
  if (!items.length) return null;
  const shown = items.slice(0, INTERACTIVES_DISPLAY_CAP);
  const hidden = items.length - shown.length;
  return (
    <details className="mt-1 rounded border border-app-border bg-app-fill/40 p-1.5 text-[10px] text-app-text">
      <summary className="cursor-pointer font-medium">
        {items.length} interactives
        {serverTruncated ? ' (truncated server-side)' : ''}
      </summary>
      <div className="mt-1 max-h-52 overflow-auto">
        <table className="w-full border-collapse text-left text-[9px]">
          <thead>
            <tr className="border-b border-app-border text-app-muted">
              <th className="py-0.5 pr-1 font-normal">Kind</th>
              <th className="py-0.5 pr-1 font-normal">Role</th>
              <th className="py-0.5 pr-1 font-normal">Text</th>
              <th className="py-0.5 font-normal">Hint</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((it, i) => (
              <tr key={i} className="align-top border-b border-app-border/50">
                <td className="py-0.5 pr-1 whitespace-nowrap">{it.kind}</td>
                <td className="py-0.5 pr-1 whitespace-nowrap">{it.role}</td>
                <td className="max-w-[140px] break-words py-0.5 pr-1">{it.text || '—'}</td>
                <td className="max-w-[120px] break-all py-0.5 text-app-muted">{it.selector_hint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hidden > 0 ? (
        <p className="mt-1 text-[9px] text-app-muted">… {hidden} more rows hidden in this panel (full data in JSON).</p>
      ) : null}
    </details>
  );
}

const FALLBACK_CRAWL_PAGES_CAP = 50;
const FALLBACK_CRAWL_DEPTH_CAP = 6;
/** Rows shown in UI tables before “truncated for display” (full JSON still in memory / save). */
const INTERACTIVES_DISPLAY_CAP = 30;
const INTERACTION_PLAN_MAX_STEPS_UI = 20;

export function WebCapturePanel({ projectKey }: { projectKey: string }) {
  const [url, setUrl] = useState('https://example.com');
  const [mode, setMode] = useState<Mode>('crawl');
  const [fullPage, setFullPage] = useState(false);
  const [deviceScaleFactor, setDeviceScaleFactor] = useState(2);
  const [omitScreenshotBg, setOmitScreenshotBg] = useState(false);
  const [renderJs, setRenderJs] = useState(true);
  const [maxDepth, setMaxDepth] = useState(3);
  const [maxPages, setMaxPages] = useState(15);
  const [sameSiteOnly, setSameSiteOnly] = useState(true);
  const [interPageDelayMs, setInterPageDelayMs] = useState(2000);
  const [includeFullText, setIncludeFullText] = useState(false);
  const [includeInteractives, setIncludeInteractives] = useState(false);
  const [includePdfs, setIncludePdfs] = useState(false);
  const [crawlPagesCap, setCrawlPagesCap] = useState(FALLBACK_CRAWL_PAGES_CAP);
  const [crawlDepthCap, setCrawlDepthCap] = useState(FALLBACK_CRAWL_DEPTH_CAP);
  const [crawlMaxSeconds, setCrawlMaxSeconds] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  /** When set, a capture run is in progress; `since` is performance.now()-compatible via Date.now() for display. */
  const [busySession, setBusySession] = useState<{ since: number; mode: Mode } | null>(null);
  /** Bumps once per second while busy so elapsed time re-renders without storing elapsed in state. */
  const [timerPulse, setTimerPulse] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [errDebug, setErrDebug] = useState<WebCaptureFailureDebug | null>(null);
  const [shot, setShot] = useState<WebScreenshotResponse | null>(null);
  const [extracted, setExtracted] = useState<WebExtractResponse | null>(null);
  const [crawl, setCrawl] = useState<WebCrawlResponse | null>(null);
  const [crawlLogLines, setCrawlLogLines] = useState<string[]>([]);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [stagingOpen, setStagingOpen] = useState(false);
  const [basicUser, setBasicUser] = useState('');
  const [basicPass, setBasicPass] = useState('');
  const [waitUntil, setWaitUntil] = useState<WaitUntil>('networkidle');
  const [postLoadDelayMs, setPostLoadDelayMs] = useState(750);
  const [consentAuto, setConsentAuto] = useState(true);
  const [extraSelectorsText, setExtraSelectorsText] = useState('');
  const [locale, setLocale] = useState('');
  const [timezoneId, setTimezoneId] = useState('');
  const [ignoreTls, setIgnoreTls] = useState(false);

  const [useFormLogin, setUseFormLogin] = useState(false);
  const [formLoginUrl, setFormLoginUrl] = useState('');
  const [formUserSel, setFormUserSel] = useState('');
  const [formPassSel, setFormPassSel] = useState('');
  const [formSubmitSel, setFormSubmitSel] = useState('');
  const [formUser, setFormUser] = useState('');
  const [formPass, setFormPass] = useState('');
  const [formPostWait, setFormPostWait] = useState<WaitUntil>('networkidle');
  const [formPostDelayMs, setFormPostDelayMs] = useState(0);

  const [interactionPlan, setInteractionPlan] = useState<WebInteractionPlanStep[]>([]);
  const [planPageIndex, setPlanPageIndex] = useState(0);

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [recordHar, setRecordHar] = useState(false);
  const [debugOnFailure, setDebugOnFailure] = useState(false);
  const [applyPlanOnCrawlSeed, setApplyPlanOnCrawlSeed] = useState(true);
  const [blockUrlsText, setBlockUrlsText] = useState('');
  const [extraHeadersText, setExtraHeadersText] = useState('');
  const [browserEngine, setBrowserEngine] = useState<string | null>(null);

  const canSave = Boolean(projectKey.trim());

  useEffect(() => {
    let cancelled = false;
    void getWebCaptureHealth().then((h) => {
      if (cancelled || !h) return;
      const p = h.max_crawl_pages;
      const d = h.max_crawl_depth;
      const t = h.max_crawl_seconds;
      if (typeof p === 'number' && p >= 1) setCrawlPagesCap(p);
      if (typeof d === 'number' && d >= 0) setCrawlDepthCap(d);
      if (typeof t === 'number' && t >= 1) setCrawlMaxSeconds(t);
      if (h.browser_engine) setBrowserEngine(h.browser_engine);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setMaxPages((v) => Math.min(v, crawlPagesCap));
    setMaxDepth((v) => Math.min(v, crawlDepthCap));
  }, [crawlPagesCap, crawlDepthCap]);

  useEffect(() => {
    if (!busy || !busySession) return;
    const id = window.setInterval(() => {
      setTimerPulse((n) => n + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [busy, busySession]);

  const buildStaging = useCallback(
    (forCrawl: boolean): WebStagingOptions => {
      const staging: WebStagingOptions = {
        wait_until: waitUntil,
        post_load_delay_ms: Math.min(15000, Math.max(0, postLoadDelayMs)),
        consent_auto_clicks: consentAuto,
        auto_dismiss_gates: true,
        extra_click_selectors: parseExtraSelectors(extraSelectorsText),
        ignore_https_errors: ignoreTls,
      };
      const blocks = parseExtraSelectors(blockUrlsText);
      if (blocks.length) staging.network_block_url_substrings = blocks;
      if (extraHeadersText.trim()) {
        try {
          const parsed = JSON.parse(extraHeadersText) as Record<string, string>;
          if (parsed && typeof parsed === 'object') staging.extra_http_headers = parsed;
        } catch {
          /* invalid JSON ignored until run validates */
        }
      }
      if (basicUser.trim() || basicPass) {
        staging.http_credentials = { username: basicUser.trim(), password: basicPass };
      }
      if (locale.trim()) staging.locale = locale.trim();
      if (timezoneId.trim()) staging.timezone_id = timezoneId.trim();

      if (!forCrawl && useFormLogin) {
        const uSel = formUserSel.trim();
        const pSel = formPassSel.trim();
        if (uSel && pSel) {
          staging.form_login = {
            login_url: formLoginUrl.trim() || null,
            username_selector: uSel,
            password_selector: pSel,
            submit_selector: formSubmitSel.trim() || null,
            username: formUser,
            password: formPass,
            post_submit_wait_until: formPostWait,
            post_submit_delay_ms: Math.min(15000, Math.max(0, formPostDelayMs)),
          };
        }
      }
      return staging;
    },
    [
      waitUntil,
      postLoadDelayMs,
      consentAuto,
      extraSelectorsText,
      ignoreTls,
      basicUser,
      basicPass,
      locale,
      timezoneId,
      useFormLogin,
      formLoginUrl,
      formUserSel,
      formPassSel,
      formSubmitSel,
      formUser,
      formPass,
      formPostWait,
      formPostDelayMs,
      blockUrlsText,
      extraHeadersText,
    ],
  );

  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [errScreenshotSrc, setErrScreenshotSrc] = useState<string | null>(null);
  const previewSrcRef = useRef<string | null>(null);
  const pdfBase64ByPageRef = useRef<Map<number, string>>(new Map());

  const applyScreenshotResult = useCallback((res: WebScreenshotResponse) => {
    if (previewSrcRef.current) URL.revokeObjectURL(previewSrcRef.current);
    if (res.image_base64) {
      const url = objectUrlFromBase64(res.image_base64, 'image/png');
      previewSrcRef.current = url;
      setPreviewSrc(url);
    } else {
      previewSrcRef.current = null;
      setPreviewSrc(null);
    }
    setShot(stripScreenshotForState(res));
  }, []);

  useEffect(() => {
    return () => {
      if (previewSrcRef.current) URL.revokeObjectURL(previewSrcRef.current);
    };
  }, []);

  useEffect(() => {
    if (!errDebug?.screenshot_base64) {
      setErrScreenshotSrc(null);
      return;
    }
    const url = objectUrlFromBase64(errDebug.screenshot_base64, 'image/png');
    setErrScreenshotSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [errDebug?.screenshot_base64]);

  const runButtonLabel = useMemo(() => {
    void timerPulse;
    if (!busy || !busySession) return 'Run';
    const sec = Math.max(0, (Date.now() - busySession.since) / 1000);
    const elapsed = formatElapsed(sec);
    if (busySession.mode === 'crawl') return `Crawling… ${elapsed}`;
    if (busySession.mode === 'extract') return `Extracting… ${elapsed}`;
    return `Capturing… ${elapsed}`;
  }, [busy, busySession, timerPulse]);

  const captureUnlocked = useMemo(() => crawlUnlocksCapture(crawl, url.trim()), [crawl, url]);

  useEffect(() => {
    if (!captureUnlocked && (mode === 'screenshot' || mode === 'extract')) {
      setMode('crawl');
    }
  }, [captureUnlocked, mode]);

  const crawlOkPageIndices = useMemo(() => {
    if (!crawl?.pages) return [];
    return crawl.pages.map((p, i) => (p.error ? -1 : i)).filter((i) => i >= 0);
  }, [crawl]);

  const planSourcePage = useMemo(() => {
    if (!crawl?.pages?.length) return null;
    const ok = crawlOkPageIndices;
    const idx = ok.includes(planPageIndex) ? planPageIndex : (ok[0] ?? 0);
    return { index: idx, row: crawl.pages[idx]! };
  }, [crawl, crawlOkPageIndices, planPageIndex]);

  useEffect(() => {
    if (!crawlOkPageIndices.length) return;
    if (!crawlOkPageIndices.includes(planPageIndex)) {
      setPlanPageIndex(crawlOkPageIndices[0]!);
    }
  }, [crawlOkPageIndices, planPageIndex]);

  const run = useCallback(async () => {
    setErr(null);
    setErrDebug(null);
    setSaveMsg(null);
    setSaveErr(null);
    if (mode === 'crawl') {
      setCrawl(null);
      pdfBase64ByPageRef.current = new Map();
      setInteractionPlan([]);
      setPlanPageIndex(0);
      setCrawlLogLines([]);
      setShot(null);
      setExtracted(null);
    } else {
      setCrawlLogLines([]);
      if (mode === 'screenshot') setShot(null);
      if (mode === 'extract') setExtracted(null);
    }
    const u = url.trim();
    if (!u) {
      setErr('Enter a URL.');
      return;
    }
    if ((mode === 'screenshot' || mode === 'extract') && !crawlUnlocksCapture(crawl, u)) {
      setErr(
        'Run a successful indexed crawl for this URL first (same origin as the crawl seed). Screenshot and extract stay locked until then.',
      );
      return;
    }
    if (extraHeadersText.trim()) {
      try {
        JSON.parse(extraHeadersText);
      } catch {
        setErr('Extra HTTP headers must be valid JSON object (e.g. {"X-Custom":"1"}).');
        return;
      }
    }
    if (basicPass && !basicUser.trim()) {
      setErr('Basic auth password is set — add a username too.');
      return;
    }
    if (useFormLogin && mode === 'crawl') {
      setErr('Form login applies to screenshot and extract (browser) only — not crawl.');
      return;
    }
    if (useFormLogin && mode === 'extract' && !renderJs) {
      setErr('Form login requires full browser render — turn off “Fast HTML only (no JS)”.');
      return;
    }
    if (useFormLogin) {
      if (!formUserSel.trim() || !formPassSel.trim()) {
        setErr('Form login needs username and password CSS selectors.');
        return;
      }
      if (!formUser.trim()) {
        setErr('Form login needs a login username.');
        return;
      }
    }

    const staging = buildStaging(mode === 'crawl');
    setBusySession({ since: Date.now(), mode });
    setBusy(true);
    try {
      const planPayload =
        interactionPlan.length > 0 ? { interaction_plan: interactionPlan.slice(0, INTERACTION_PLAN_MAX_STEPS_UI) } : {};
      const advancedPayload = { record_har: recordHar, debug_on_failure: debugOnFailure };
      if (mode === 'screenshot') {
        const res = await postWebScreenshot({
          url: u,
          full_page: fullPage,
          device_scale_factor: deviceScaleFactor,
          omit_background: omitScreenshotBg,
          include_interactives: includeInteractives,
          staging,
          ...planPayload,
          ...advancedPayload,
        });
        applyScreenshotResult(res);
      } else if (mode === 'extract') {
        const res = await postWebExtract({
          url: u,
          render_js: renderJs,
          include_interactives: includeInteractives,
          staging,
          ...planPayload,
          ...advancedPayload,
        });
        setExtracted(res);
      } else {
        const crawlBody = {
          url: u,
          max_depth: maxDepth,
          max_pages: maxPages,
          same_site_only: sameSiteOnly,
          inter_page_delay_ms: interPageDelayMs,
          include_full_text: includeFullText,
          include_interactives: includeInteractives,
          include_pdfs: includePdfs,
          auto_dismiss_gates: true,
          staging,
          ...advancedPayload,
          ...(applyPlanOnCrawlSeed && interactionPlan.length > 0
            ? { interaction_plan: interactionPlan.slice(0, INTERACTION_PLAN_MAX_STEPS_UI) }
            : {}),
        };
        try {
          const storeCrawlResult = (result: WebCrawlResponse) => {
            const pdfs = new Map<number, string>();
            result.pages.forEach((p, i) => {
              if (p.pdf_base64) pdfs.set(i, p.pdf_base64);
            });
            pdfBase64ByPageRef.current = pdfs;
            setCrawl(stripCrawlForState(result));
          };
          let result: WebCrawlResponse | null = await tryPostWebCrawlStream(crawlBody, (line) => {
            setCrawlLogLines((prev) => (prev.length >= 500 ? [...prev.slice(-450), line] : [...prev, line]));
          });
          if (!result) {
            result = await postWebCrawl(crawlBody);
          }
          storeCrawlResult(result);
        } catch (streamErr) {
          try {
            const result = await postWebCrawl(crawlBody);
            const pdfs = new Map<number, string>();
            result.pages.forEach((p, i) => {
              if (p.pdf_base64) pdfs.set(i, p.pdf_base64);
            });
            pdfBase64ByPageRef.current = pdfs;
            setCrawl(stripCrawlForState(result));
          } catch {
            setErr(streamErr instanceof Error ? streamErr.message : String(streamErr));
          }
        }
      }
    } catch (e: unknown) {
      if (e instanceof WebCaptureError) {
        setErr(e.message);
        setErrDebug(e.debug ?? null);
      } else {
        setErr(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
      setBusySession(null);
    }
  }, [
    url,
    mode,
    crawl,
    fullPage,
    deviceScaleFactor,
    omitScreenshotBg,
    renderJs,
    maxDepth,
    maxPages,
    sameSiteOnly,
    interPageDelayMs,
    includeFullText,
    includeInteractives,
    includePdfs,
    interactionPlan,
    buildStaging,
    useFormLogin,
    formUserSel,
    formPassSel,
    recordHar,
    debugOnFailure,
    applyPlanOnCrawlSeed,
    applyScreenshotResult,
    extraHeadersText,
  ]);

  const saveCapture = useCallback(async () => {
    setSaveMsg(null);
    setSaveErr(null);
    if (!canSave) {
      setSaveErr('Select a project to save files.');
      return;
    }
    const slug = stampSlug();
    try {
      if (previewSrc && shot) {
        const blob = await fetch(previewSrc).then((r) => r.blob());
        const file = new File([blob], `web-capture-${slug}.png`, { type: 'image/png' });
        await uploadProjectDocument(projectKey.trim(), file, 'general');
        setSaveMsg(`Saved PNG to project (${file.name}).`);
        return;
      }
      if (extracted) {
        const header = extracted.title ? `${extracted.title}\n${extracted.url}\n\n` : `${extracted.url}\n\n`;
        const blob = new Blob([header + extracted.text], { type: 'text/plain;charset=utf-8' });
        const file = new File([blob], `web-extract-${slug}.txt`, { type: 'text/plain' });
        await uploadProjectDocument(projectKey.trim(), file, 'general');
        setSaveMsg(`Saved text extract (${file.name}).`);
        return;
      }
      if (crawl?.pages?.length) {
        const indexForSave = {
          ...crawl,
          pages: crawl.pages.map((p) => {
            const { pdf_base64: _pdf, ...rest } = p;
            return rest;
          }),
        };
        const blob = new Blob([JSON.stringify(indexForSave, null, 2)], {
          type: 'application/json;charset=utf-8',
        });
        const file = new File([blob], `web-crawl-${slug}.json`, { type: 'application/json' });
        await uploadProjectDocument(projectKey.trim(), file, 'general');
        let pdfCount = 0;
        for (let i = 0; i < crawl.pages.length; i++) {
          const p = crawl.pages[i]!;
          const pdfB64 = pdfBase64ByPageRef.current.get(i);
          if (!pdfB64 || p.error) continue;
          const pdfBlob = base64ToBlob(pdfB64, 'application/pdf');
          const pdfFile = new File([pdfBlob], crawlPagePdfFilename(p, i), { type: 'application/pdf' });
          await uploadProjectDocument(projectKey.trim(), pdfFile, 'general');
          pdfCount += 1;
        }
        setSaveMsg(
          pdfCount > 0
            ? `Saved crawl index (${file.name}) and ${pdfCount} PDF(s) to project.`
            : `Saved crawl JSON (${file.name}).`,
        );
        return;
      }
      setSaveErr('Nothing to save yet — run a capture first.');
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    }
  }, [canSave, projectKey, shot, extracted, crawl, previewSrc]);

  const inputCls =
    'mt-1 w-full rounded-md border border-app-border bg-app-fill p-1.5 text-xs text-app-text outline-none focus:border-indigo-400 focus:bg-app-surface dark:focus:border-indigo-500';

  return (
    <div className="rounded border border-app-border bg-app-fill/70 p-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[200px] flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-app-muted">URL</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={inputCls}
            placeholder="https://…"
            disabled={busy}
          />
        </label>
        <label>
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-app-muted">Mode</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            disabled={busy}
            className="mt-1 rounded-md border border-app-border bg-app-fill p-2 text-xs text-app-text outline-none focus:border-indigo-400 dark:focus:border-indigo-500"
          >
            <option value="crawl">Indexed crawl</option>
            <option value="extract" disabled={!captureUnlocked}>
              Extract text (after crawl)
            </option>
            <option value="screenshot" disabled={!captureUnlocked}>
              Screenshot (after crawl)
            </option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void run()}
          disabled={
            busy ||
            ((mode === 'screenshot' || mode === 'extract') && !captureUnlocked)
          }
          className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {runButtonLabel}
        </button>
      </div>
      {!captureUnlocked ? (
        <p className="mt-1 text-[10px] text-app-muted">
          Run an indexed crawl for this URL first. Screenshot and Extract unlock when the crawl has at least one
          successful page and the URL matches the crawl seed origin.
        </p>
      ) : null}

      {busy && busySession?.mode === 'crawl' ? (
        <div
          className="mt-2 rounded-md border border-indigo-200 bg-indigo-50/90 p-2 text-[11px] text-indigo-950 dark:border-indigo-500/40 dark:bg-indigo-950/40 dark:text-indigo-100"
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold text-indigo-900 dark:text-indigo-50">
            Indexed crawl in progress · {formatElapsed(Math.max(0, (Date.now() - busySession.since) / 1000))} elapsed
          </p>
          <p className="mt-1 text-[10px] text-indigo-900/90 dark:text-indigo-100/90">
            The server is opening a browser context per page (up to <strong>{maxPages}</strong> pages, depth ≤{' '}
            <strong>{maxDepth}</strong>
            {sameSiteOnly ? ', same site only' : ''}). {interPageDelayMs > 0 ? `Delay between pages: ${interPageDelayMs} ms. ` : ''}
            {includeFullText ? 'Full article text is extracted per page (capped server-side). ' : 'Full article text is off by default (enable below to add index payload). '}
            {includePdfs
              ? 'Each page is printed to PDF (no PNG screenshots). '
              : 'PDF export is off by default (enable below to reduce response size). '}
            This often takes <strong>several minutes</strong>
            {crawlMaxSeconds != null
              ? ` (hard cap ~${Math.ceil(crawlMaxSeconds / 60)} min from browser-runner).`
              : '.'}{' '}
            Live URL events stream below when supported; otherwise the run completes in one step.
          </p>
          <p className="mt-1 font-mono text-[10px] text-indigo-800/80 dark:text-indigo-200/80">
            {url.trim() || '(no URL)'}
          </p>
        </div>
      ) : null}

      {mode === 'crawl' && crawlLogLines.length > 0 ? (
        <div className="mt-2 rounded-md border border-app-border bg-app-surface/90 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Live crawl log</p>
          <pre className="mt-1 max-h-44 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-app-text">
            {crawlLogLines.join('\n')}
          </pre>
        </div>
      ) : null}

      {busy && busySession && busySession.mode !== 'crawl' ? (
        <p className="mt-2 text-[11px] text-app-muted" role="status" aria-live="polite">
          {busySession.mode === 'extract' ? 'Extract' : 'Screenshot'} in progress —{' '}
          <span className="font-mono text-app-text">{formatElapsed(Math.max(0, (Date.now() - busySession.since) / 1000))}</span>{' '}
          elapsed. Page may be loading scripts or waiting for network idle.
        </p>
      ) : null}

      <div className="mt-2 rounded-md border border-app-border bg-app-surface/80">
        <div className="flex items-center justify-between gap-2 border-b border-app-border px-2 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Staging / auth</span>
          <button
            type="button"
            className="flex shrink-0 items-center justify-center rounded px-1 py-0.5 text-app-muted hover:bg-app-fill-hover"
            aria-expanded={stagingOpen}
            aria-controls="web-capture-staging-body"
            aria-label={stagingOpen ? 'Collapse staging options' : 'Expand staging options'}
            onClick={() => setStagingOpen((v) => !v)}
          >
            <PanelChevron expanded={stagingOpen} />
          </button>
        </div>
        {stagingOpen ? (
          <div id="web-capture-staging-body" className="space-y-2 p-2 text-[11px] text-app-text">
            <p className="text-[10px] text-app-muted">
              HTTP Basic auth covers gateway prompts. Form login fills HTML fields (no SSO/Okta magic links). Use extra
              selectors to click cookie banners or expand/collapse regions before capture.
            </p>
            <div className="grid gap-2 tablet:grid-cols-2">
              <label>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Basic auth user</span>
                <input
                  value={basicUser}
                  onChange={(e) => setBasicUser(e.target.value)}
                  className={inputCls}
                  autoComplete="off"
                  disabled={busy}
                />
              </label>
              <label>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Basic auth password</span>
                <input
                  type="password"
                  value={basicPass}
                  onChange={(e) => setBasicPass(e.target.value)}
                  className={inputCls}
                  autoComplete="new-password"
                  disabled={busy}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Wait until</span>
                <select
                  value={waitUntil}
                  onChange={(e) => setWaitUntil(e.target.value as WaitUntil)}
                  disabled={busy}
                  className={inputCls}
                >
                  <option value="domcontentloaded">domcontentloaded</option>
                  <option value="load">load</option>
                  <option value="networkidle">networkidle (recommended)</option>
                </select>
              </label>
              <label>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Post-load delay ms</span>
                <input
                  type="number"
                  min={0}
                  max={15000}
                  value={postLoadDelayMs}
                  onChange={(e) => setPostLoadDelayMs(Number(e.target.value))}
                  disabled={busy}
                  className={`${inputCls} w-28`}
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2 pt-5">
                <input type="checkbox" checked={consentAuto} onChange={(e) => setConsentAuto(e.target.checked)} disabled={busy} />
                Auto-click common consent buttons
              </label>
              <label className="flex cursor-pointer items-center gap-2 pt-5">
                <input type="checkbox" checked={ignoreTls} onChange={(e) => setIgnoreTls(e.target.checked)} disabled={busy} />
                Ignore HTTPS errors
              </label>
            </div>
            <p className="text-[10px] text-app-muted">
              Ignore HTTPS errors only works when browser-runner has <code className="rounded bg-app-fill px-0.5">WEB_ALLOW_INSECURE_TLS=true</code>.
            </p>
            <div className="grid gap-2 tablet:grid-cols-2">
              <label>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Locale (optional)</span>
                <input
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  className={inputCls}
                  placeholder="en-US"
                  disabled={busy}
                />
              </label>
              <label>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Timezone ID (optional)</span>
                <input
                  value={timezoneId}
                  onChange={(e) => setTimezoneId(e.target.value)}
                  className={inputCls}
                  placeholder="America/New_York"
                  disabled={busy}
                />
              </label>
            </div>
            <label>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">
                Extra click selectors (comma or newline; cookies, expand/collapse, etc.)
              </span>
              <textarea
                value={extraSelectorsText}
                onChange={(e) => setExtraSelectorsText(e.target.value)}
                className={`${inputCls} min-h-[4rem] font-mono`}
                placeholder={'#accept-cookies\nbutton.expand-section'}
                disabled={busy}
              />
            </label>

            <div className="rounded border border-app-border/80 bg-app-fill/40 p-2">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={useFormLogin}
                  onChange={(e) => setUseFormLogin(e.target.checked)}
                  disabled={busy || mode === 'crawl'}
                />
                <span className="font-medium">HTML form login before capture</span>
                {mode === 'crawl' ? <span className="text-app-muted">(not used in crawl)</span> : null}
              </label>
              {useFormLogin && mode !== 'crawl' ? (
                <div className="mt-2 space-y-2">
                  <label>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">
                      Login page URL (optional — defaults to main URL)
                    </span>
                    <input value={formLoginUrl} onChange={(e) => setFormLoginUrl(e.target.value)} className={inputCls} disabled={busy} />
                  </label>
                  <div className="grid gap-2 tablet:grid-cols-2">
                    <label>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Username selector</span>
                      <input value={formUserSel} onChange={(e) => setFormUserSel(e.target.value)} className={`${inputCls} font-mono`} disabled={busy} />
                    </label>
                    <label>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Password selector</span>
                      <input value={formPassSel} onChange={(e) => setFormPassSel(e.target.value)} className={`${inputCls} font-mono`} disabled={busy} />
                    </label>
                  </div>
                  <label>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">
                      Submit selector (optional — Enter used if empty)
                    </span>
                    <input value={formSubmitSel} onChange={(e) => setFormSubmitSel(e.target.value)} className={`${inputCls} font-mono`} disabled={busy} />
                  </label>
                  <div className="grid gap-2 tablet:grid-cols-2">
                    <label>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Login username</span>
                      <input value={formUser} onChange={(e) => setFormUser(e.target.value)} className={inputCls} autoComplete="off" disabled={busy} />
                    </label>
                    <label>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Login password</span>
                      <input type="password" value={formPass} onChange={(e) => setFormPass(e.target.value)} className={inputCls} autoComplete="new-password" disabled={busy} />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <label>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">After submit wait</span>
                      <select value={formPostWait} onChange={(e) => setFormPostWait(e.target.value as WaitUntil)} disabled={busy} className={inputCls}>
                        <option value="domcontentloaded">domcontentloaded</option>
                        <option value="load">load</option>
                        <option value="networkidle">networkidle</option>
                      </select>
                    </label>
                    <label>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Post-submit delay ms</span>
                      <input
                        type="number"
                        min={0}
                        max={15000}
                        value={formPostDelayMs}
                        onChange={(e) => setFormPostDelayMs(Number(e.target.value))}
                        disabled={busy}
                        className={`${inputCls} w-28`}
                      />
                    </label>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <label className="mt-2 flex cursor-pointer flex-col gap-0.5 text-[11px] text-app-text">
        <span className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeInteractives}
            onChange={(e) => setIncludeInteractives(e.target.checked)}
            disabled={busy}
          />
          Include interactives inventory (larger JSON)
        </span>
        <span className="pl-6 text-[10px] text-app-muted">
          Crawl stream logs counts per page; full arrays are in the final crawl JSON only. Fast HTML extract (no JS)
          does not collect interactives. Saving a crawl with this on can produce very large files.
        </span>
      </label>

      {captureUnlocked ? (
        <div className="mt-2 rounded-md border border-app-border bg-app-surface/80 p-2 text-[11px] text-app-text">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">
            Interaction plan (crawl seed + screenshot / JS extract)
          </p>
          <p className="mt-1 text-[10px] text-app-muted">
            Indexed crawl auto-dismisses HCP interstitials and cookie banners on every page (see overlay counts in the
            live log). Steps below run after that, on the seed page only (before link discovery). Interactives still
            lists any controls remaining after dismissal. Edit selectors before capture when needed. Max{' '}
            {INTERACTION_PLAN_MAX_STEPS_UI} steps, {WEB_INTERACTION_SELECTOR_MAX_LEN} chars per selector.
          </p>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-[10px]">
            <input
              type="checkbox"
              checked={applyPlanOnCrawlSeed}
              onChange={(e) => setApplyPlanOnCrawlSeed(e.target.checked)}
              disabled={busy}
            />
            Apply plan when running indexed crawl (seed page)
          </label>
          {crawlOkPageIndices.length > 0 ? (
            <label className="mt-2 block">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Crawl page for hints</span>
              <select
                className={`${inputCls} mt-1 max-w-full`}
                value={planPageIndex}
                onChange={(e) => setPlanPageIndex(Number(e.target.value))}
                disabled={busy}
              >
                {crawlOkPageIndices.map((i) => {
                  const p = crawl!.pages[i]!;
                  return (
                    <option key={i} value={i}>
                      [{i}] {p.title || p.url || 'page'}
                    </option>
                  );
                })}
              </select>
            </label>
          ) : null}
          {planSourcePage?.row.interactives?.length ? (
            <div className="mt-2 max-h-36 overflow-auto rounded border border-app-border bg-app-fill/50 p-1">
              <p className="text-[10px] text-app-muted">Add click from inventory</p>
              <ul className="mt-1 space-y-0.5 text-[10px]">
                {planSourcePage.row.interactives.map((it, ix) => (
                  <li key={ix} className="flex flex-wrap items-center gap-1 border-b border-app-border/40 py-0.5 last:border-0">
                    <span className="text-app-muted">{it.kind}</span>
                    <span className="max-w-[140px] truncate">{it.text || it.selector_hint}</span>
                    <button
                      type="button"
                      disabled={busy || interactionPlan.length >= INTERACTION_PLAN_MAX_STEPS_UI}
                      className="rounded border border-app-border px-1 py-0 text-[9px] hover:bg-app-fill disabled:opacity-40"
                      onClick={() =>
                        setInteractionPlan((prev) => {
                          if (prev.length >= INTERACTION_PLAN_MAX_STEPS_UI) return prev;
                          return [
                            ...prev,
                            {
                              action: 'click' as const,
                              selector: selectorFromInventoryItem(it),
                            },
                          ];
                        })
                      }
                    >
                      Add click
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-2 text-[10px] text-app-muted">
              No interactives on this crawl page — run crawl with &quot;Include interactives inventory&quot; or add steps
              manually below.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || interactionPlan.length >= INTERACTION_PLAN_MAX_STEPS_UI}
              className="rounded border border-app-border bg-app-fill px-2 py-0.5 text-[10px] disabled:opacity-40"
              onClick={() =>
                setInteractionPlan((prev) => {
                  if (prev.length >= INTERACTION_PLAN_MAX_STEPS_UI) return prev;
                  return [...prev, { action: 'wait_ms', wait_ms: 250 }];
                })
              }
            >
              Append wait 250ms
            </button>
            <button
              type="button"
              disabled={busy || interactionPlan.length === 0}
              className="rounded border border-app-border px-2 py-0.5 text-[10px] disabled:opacity-40"
              onClick={() => setInteractionPlan([])}
            >
              Clear plan
            </button>
          </div>
          {interactionPlan.length > 0 ? (
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-[10px]">
              {interactionPlan.map((step, si) => (
                <li key={si} className="pl-0.5">
                  {step.action === 'wait_ms' ? (
                    <span>wait {step.wait_ms} ms</span>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-app-muted">click</span>
                      <input
                        className={`${inputCls} font-mono text-[10px]`}
                        value={step.selector}
                        maxLength={WEB_INTERACTION_SELECTOR_MAX_LEN}
                        onChange={(e) => {
                          const v = e.target.value.slice(0, WEB_INTERACTION_SELECTOR_MAX_LEN);
                          setInteractionPlan((prev) => {
                            const next = [...prev];
                            const cur = next[si];
                            if (cur && cur.action === 'click') next[si] = { action: 'click', selector: v };
                            return next;
                          });
                        }}
                        disabled={busy}
                      />
                    </div>
                  )}
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    <button
                      type="button"
                      className="text-[9px] text-indigo-600 disabled:opacity-40 dark:text-indigo-400"
                      disabled={busy || si === 0}
                      onClick={() =>
                        setInteractionPlan((prev) => {
                          if (si === 0) return prev;
                          const n = [...prev];
                          [n[si - 1], n[si]] = [n[si]!, n[si - 1]!];
                          return n;
                        })
                      }
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="text-[9px] text-indigo-600 disabled:opacity-40 dark:text-indigo-400"
                      disabled={busy || si >= interactionPlan.length - 1}
                      onClick={() =>
                        setInteractionPlan((prev) => {
                          if (si >= prev.length - 1) return prev;
                          const n = [...prev];
                          [n[si], n[si + 1]] = [n[si + 1]!, n[si]!];
                          return n;
                        })
                      }
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      className="text-[9px] text-rose-600 disabled:opacity-40 dark:text-rose-400"
                      disabled={busy}
                      onClick={() => setInteractionPlan((prev) => prev.filter((_, j) => j !== si))}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}

      {mode === 'screenshot' ? (
        <div className="mt-2 flex flex-wrap items-end gap-3 text-[11px] text-app-text">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={fullPage} onChange={(e) => setFullPage(e.target.checked)} disabled={busy} />
            Full page
          </label>
          <label className="flex items-center gap-1">
            Device scale
            <input
              type="number"
              min={1}
              max={4}
              step={0.5}
              value={deviceScaleFactor}
              onChange={(e) => setDeviceScaleFactor(Number(e.target.value))}
              disabled={busy}
              className="w-14 rounded border border-app-border bg-app-fill px-1 py-0.5"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={omitScreenshotBg}
              onChange={(e) => setOmitScreenshotBg(e.target.checked)}
              disabled={busy}
            />
            Omit background (transparent PNG)
          </label>
        </div>
      ) : null}

      {mode === 'extract' ? (
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-app-text">
          <input
            type="checkbox"
            checked={!renderJs}
            onChange={(e) => setRenderJs(!e.target.checked)}
            disabled={busy}
          />
          Fast HTML only (no JS)
        </label>
      ) : null}

      {mode === 'crawl' ? (
        <div className="mt-2 flex flex-col gap-2 text-[11px] text-app-text">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1">
              Max depth
              <input
                type="number"
                min={0}
                max={crawlDepthCap}
                value={maxDepth}
                onChange={(e) =>
                  setMaxDepth(Math.min(crawlDepthCap, Math.max(0, Number(e.target.value))))
                }
                disabled={busy}
                className="w-14 rounded border border-app-border bg-app-fill px-1 py-0.5"
              />
            </label>
            <label className="flex items-center gap-1">
              Max pages
              <input
                type="number"
                min={1}
                max={crawlPagesCap}
                value={maxPages}
                onChange={(e) =>
                  setMaxPages(Math.min(crawlPagesCap, Math.max(1, Number(e.target.value))))
                }
                disabled={busy}
                className="w-14 rounded border border-app-border bg-app-fill px-1 py-0.5"
              />
            </label>
            <label className="flex items-center gap-1">
              Inter-page delay ms
              <input
                type="number"
                min={0}
                max={120000}
                value={interPageDelayMs}
                onChange={(e) =>
                  setInterPageDelayMs(Math.min(120000, Math.max(0, Number(e.target.value))))
                }
                disabled={busy}
                className="w-20 rounded border border-app-border bg-app-fill px-1 py-0.5"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-1">
              <input type="checkbox" checked={sameSiteOnly} onChange={(e) => setSameSiteOnly(e.target.checked)} disabled={busy} />
              Same site only
            </label>
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={includeFullText}
              onChange={(e) => setIncludeFullText(e.target.checked)}
              disabled={busy}
            />
            Include full article text per page (opt-in; increases crawl JSON size)
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={includePdfs}
              onChange={(e) => setIncludePdfs(e.target.checked)}
              disabled={busy}
            />
            Include print-to-PDF per page (opt-in; large JSON — enable only when needed)
          </label>
        </div>
      ) : null}

      <div className="mt-2 rounded-md border border-app-border bg-app-surface/80">
        <div className="flex items-center justify-between gap-2 border-b border-app-border px-2 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">
            Advanced{browserEngine ? ` · engine: ${browserEngine}` : ''}
          </span>
          <button
            type="button"
            className="flex shrink-0 items-center justify-center rounded px-1 py-0.5 text-app-muted hover:bg-app-fill-hover"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            <PanelChevron expanded={advancedOpen} />
          </button>
        </div>
        {advancedOpen ? (
          <div className="space-y-2 p-2 text-[11px] text-app-text">
            <p className="text-[10px] text-app-muted">
              HAR and Playwright traces may contain cookies and auth headers. Debug artifacts attach to HTTP 502
              responses when enabled.
            </p>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={recordHar} onChange={(e) => setRecordHar(e.target.checked)} disabled={busy} />
              Record HAR (seed page on crawl; capped server-side)
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={debugOnFailure}
                onChange={(e) => setDebugOnFailure(e.target.checked)}
                disabled={busy}
              />
              Debug on failure (screenshot + trace on 502)
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">
                Block URL substrings (comma/newline, max 20)
              </span>
              <textarea
                value={blockUrlsText}
                onChange={(e) => setBlockUrlsText(e.target.value)}
                disabled={busy}
                rows={2}
                className={`${inputCls} font-mono text-[10px]`}
                placeholder="googletagmanager.com, doubleclick.net"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">
                Extra HTTP headers (JSON object)
              </span>
              <textarea
                value={extraHeadersText}
                onChange={(e) => setExtraHeadersText(e.target.value)}
                disabled={busy}
                rows={2}
                className={`${inputCls} font-mono text-[10px]`}
                placeholder='{"X-Custom-Header":"value"}'
              />
            </label>
          </div>
        ) : null}
      </div>

      {err ? (
        <div className="mt-2 rounded border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-800 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100">
          <p>{err}</p>
          {errScreenshotSrc ? (
            <div className="mt-2">
              <p className="text-[10px] font-semibold">Failure screenshot</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={errScreenshotSrc}
                alt="Failure debug"
                className="mt-1 max-h-40 rounded border border-rose-300/50"
              />
            </div>
          ) : null}
          {errDebug?.trace_base64 ? (
            <button
              type="button"
              className="mt-2 block text-[10px] font-semibold text-indigo-700 underline dark:text-indigo-300"
              onClick={() =>
                downloadBase64File(errDebug.trace_base64!, 'application/zip', 'web-capture-trace.zip')
              }
            >
              Download Playwright trace (.zip)
            </button>
          ) : null}
          {errDebug?.final_url ? (
            <p className="mt-1 break-all text-[10px] opacity-90">Final URL: {errDebug.final_url}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {previewSrc ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Preview</p>
            {shot?.final_url && shot.final_url !== shot.url ? (
              <p className="mt-0.5 break-all text-[10px] text-app-muted">Final URL: {shot.final_url}</p>
            ) : null}
            {shot?.device_scale_factor != null ? (
              <p className="text-[10px] text-app-muted">Device scale: {shot.device_scale_factor}</p>
            ) : null}
            {shot?.overlay_clicks_attempted != null ? (
              <p className="text-[10px] text-app-muted">Overlay clicks attempted: {shot.overlay_clicks_attempted}</p>
            ) : null}
            {shot?.interactives && shot.interactives.length > 0 ? (
              <InteractivesDetails items={shot.interactives} serverTruncated={shot.interactives_truncated} />
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt="Screenshot preview"
              className="mt-1 max-h-[360px] max-w-full overflow-auto rounded border border-app-border bg-white object-contain object-left-top dark:bg-zinc-900"
            />
          </div>
        ) : null}

        {extracted ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Extracted</p>
            {extracted.final_url && extracted.final_url !== extracted.url ? (
              <p className="mt-0.5 break-all text-[10px] text-app-muted">Final URL: {extracted.final_url}</p>
            ) : null}
            {extracted.overlay_clicks_attempted != null ? (
              <p className="text-[10px] text-app-muted">Overlay clicks attempted: {extracted.overlay_clicks_attempted}</p>
            ) : null}
            {extracted.interactives && extracted.interactives.length > 0 ? (
              <InteractivesDetails items={extracted.interactives} serverTruncated={extracted.interactives_truncated} />
            ) : null}
            {extracted.title ? (
              <p className="mt-1 text-xs font-semibold text-app-text">{extracted.title}</p>
            ) : null}
            <pre className="mt-1 max-h-[280px] overflow-auto whitespace-pre-wrap rounded border border-app-border bg-app-surface p-2 text-[11px] text-app-text">
              {extracted.text}
              {extracted.truncated ? '\n\n… truncated' : ''}
            </pre>
          </div>
        ) : null}

        {crawl?.pages?.length ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">
              Crawl ({crawl.visited_count} visited)
            </p>
            <ul className="mt-1 max-h-[280px] space-y-1 overflow-auto rounded border border-app-border bg-app-surface p-2 text-[11px] text-app-text">
              {crawl.pages.map((p, pageIdx) => (
                <li key={`${p.url}-${p.depth}-${pageIdx}`} className="border-b border-app-border/60 pb-1 last:border-0">
                  <div className="font-medium text-indigo-700 dark:text-indigo-300">{p.title || p.url || '—'}</div>
                  <div className="break-all text-app-muted">{p.url}</div>
                  {p.final_url && p.final_url !== p.url ? (
                    <div className="break-all text-[10px] text-app-muted">Final: {p.final_url}</div>
                  ) : null}
                  {p.overlay_clicks_attempted != null ? (
                    <div className="text-[10px] text-app-muted">Overlay clicks: {p.overlay_clicks_attempted}</div>
                  ) : null}
                  {p.error ? <div className="text-rose-600 dark:text-rose-400">{p.error}</div> : null}
                  {p.headings && p.headings.length > 0 ? (
                    <div className="text-[10px] text-app-muted">
                      Headings: {p.headings.slice(0, 5).join(' · ')}
                      {p.headings.length > 5 ? ' …' : ''}
                    </div>
                  ) : null}
                  {p.excerpt ? <div className="text-app-muted">{p.excerpt}</div> : null}
                  {p.article_text ? (
                    <div className="text-[10px] text-app-muted">
                      Article: {p.article_text.slice(0, 280)}
                      {p.article_text.length > 280 || p.article_truncated ? '…' : ''}
                    </div>
                  ) : null}
                  {p.interactives && p.interactives.length > 0 ? (
                    <InteractivesDetails items={p.interactives} serverTruncated={p.interactives_truncated} />
                  ) : null}
                  {pdfBase64ByPageRef.current.has(pageIdx) ? (
                    <button
                      type="button"
                      className="mt-0.5 block text-[10px] font-semibold text-indigo-600 underline dark:text-indigo-400"
                      onClick={() => {
                        const pdfB64 = pdfBase64ByPageRef.current.get(pageIdx);
                        if (!pdfB64) return;
                        downloadBase64File(pdfB64, 'application/pdf', crawlPagePdfFilename(p, pageIdx));
                      }}
                    >
                      Download PDF{p.pdf_truncated ? ' (truncated)' : ''}
                    </button>
                  ) : null}
                  {p.pdf_error ? (
                    <div className="text-[10px] text-rose-600 dark:text-rose-400">PDF: {p.pdf_error}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void saveCapture()}
          disabled={busy || !canSave || (!shot && !extracted && !crawl?.pages?.length)}
          className="rounded-md border border-app-border bg-app-surface px-3 py-1.5 text-[11px] font-semibold text-app-text hover:bg-app-fill disabled:opacity-50"
        >
          Save to project
        </button>
        {!canSave ? (
          <span className="text-[10px] text-app-muted">Choose a project above to enable save.</span>
        ) : null}
      </div>
      {saveMsg ? (
        <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50/90 p-2 text-[10px] text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-100">
          {saveMsg}
        </div>
      ) : null}
      {saveErr ? (
        <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-[10px] text-rose-800 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100">
          {saveErr}
        </div>
      ) : null}
    </div>
  );
}
