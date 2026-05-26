import fs from 'node:fs/promises';
import path from 'node:path';
import { highlightVeevaTokensMagenta, stripPreviewTokenHighlights } from './rte-token-html.js';

type AssemblyWarning = { severity: 'info' | 'warning' | 'error'; code: string; message: string; source?: string };

export const SUBMISSION_PAGE_COUNT = 3;

export type SubmissionPreviewMode = 'tokens' | 'processed';

export type CaptureHeader = {
  to: string;
  from: string;
  subject: string;
};

/** Scale factor to fit image in box (never upscale above 1). */
export function computeFitScale(imgW: number, imgH: number, boxW: number, boxH: number): number {
  if (imgW <= 0 || imgH <= 0 || boxW <= 0 || boxH <= 0) return 1;
  return Math.min(1, boxW / imgW, boxH / imgH);
}

export function buildSubmissionPageCount(): number {
  return SUBMISSION_PAGE_COUNT;
}

function escapeHtml(v: string) {
  return v.replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]!));
}

/** Read PNG width/height from IHDR (bytes 16–27). */
export function readPngDimensions(pngPath: string): Promise<{ width: number; height: number }> {
  return fs.readFile(pngPath).then((buf) => {
    if (buf.length < 24 || buf[0] !== 0x89 || buf.toString('ascii', 1, 4) !== 'PNG') {
      throw new Error(`Not a PNG file: ${pngPath}`);
    }
    return {
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20),
    };
  });
}

export function emailHtmlForPreviewMode(mode: SubmissionPreviewMode): string {
  return mode === 'tokens' ? 'assembled-email-tokens.html' : 'assembled-email-processed.html';
}

async function resolveEmailIframeSrc(
  outputDir: string,
  mode: SubmissionPreviewMode,
  warnings: AssemblyWarning[],
): Promise<string> {
  const preferred = emailHtmlForPreviewMode(mode);
  try {
    await fs.access(path.join(outputDir, preferred));
    return preferred;
  } catch {
    // fall through
  }
  const legacy = path.join(outputDir, 'assembled-email.html');
  try {
    await fs.readFile(legacy, 'utf8');
    warnings.push({
      severity: 'warning',
      code: 'SUBMISSION_VARIANT_FALLBACK',
      message: `${preferred} not found (re-build the suite for token/processed variants). Using assembled-email.html.`,
    });
    if (mode === 'processed') {
      const stripped = stripPreviewTokenHighlights(await fs.readFile(legacy, 'utf8'));
      const fallbackPath = 'assembled-email-processed-fallback.html';
      await fs.writeFile(path.join(outputDir, fallbackPath), stripped);
      return fallbackPath;
    }
    if (mode === 'tokens') {
      const highlighted = highlightVeevaTokensMagenta(await fs.readFile(legacy, 'utf8'));
      const fallbackPath = 'assembled-email-tokens-fallback.html';
      await fs.writeFile(path.join(outputDir, fallbackPath), highlighted);
      return fallbackPath;
    }
    return 'assembled-email.html';
  } catch {
    throw new Error('assembled-email.html not found. Build an RTE package first.');
  }
}

function makeCaptureShellHtml(contentWidth: 600 | 400, header: CaptureHeader, emailSrc: string): string {
  const viewportMeta =
    contentWidth === 400 ? '<meta name="viewport" content="width=400, initial-scale=1">' : '';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">${viewportMeta}
<meta name="color-scheme" content="light">
<title>Submission capture ${contentWidth}px</title>
<style>
html{color-scheme:only light}
body{margin:0;padding:16px;background:#e8eaed;font-family:Arial,Helvetica,sans-serif;color:#111}
.shell{width:${contentWidth}px;margin:0 auto;background:#fff;border:1px solid #c5c9d0;box-shadow:0 1px 4px rgba(0,0,0,.08)}
.hdr{padding:10px 12px 8px;font-size:11px;line-height:1.45;color:#333;border-bottom:1px solid #e5e7eb}
.hdr div{margin:2px 0}
.hdr .subj{color:#111}
.frame-wrap{overflow:hidden}
iframe{display:block;width:${contentWidth}px;border:0;vertical-align:top}
</style></head><body>
<div class="shell">
<div class="hdr">
<div><strong>To:</strong> ${escapeHtml(header.to)}</div>
<div><strong>From:</strong> ${escapeHtml(header.from)}</div>
<div class="subj"><strong>Subject:</strong> ${escapeHtml(header.subject)}</div>
</div>
<div class="frame-wrap"><iframe id="email" title="Assembled email" src="${escapeHtml(emailSrc)}"></iframe></div>
</div>
<script>
(function(){
  var iframe=document.getElementById('email');
  function resize(){
    try{
      var doc=iframe.contentDocument;
      if(!doc||!doc.body)return;
      var h=Math.max(doc.body.scrollHeight,doc.documentElement.scrollHeight);
      iframe.style.height=h+'px';
    }catch(e){}
  }
  iframe.addEventListener('load',function(){resize();setTimeout(resize,400);setTimeout(resize,1200);});
})();
</script>
</body></html>`;
}

function subjectLinesHtml(lines: string[]): string {
  return lines
    .map(
      (line, i) =>
        `<li class="subj-line${i < lines.length - 1 ? ' with-rule' : ''}">${escapeHtml(line)}</li>`,
    )
    .join('');
}

function buildSubmissionDocumentHtml(params: {
  emailTitle: string;
  subjectLines: string[];
  desktopImageRel: string;
  mobileImageRel: string;
}): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(params.emailTitle)} — Submission</title>
<style>
@page{size:letter landscape;margin:0.28in}
*{box-sizing:border-box}
body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#111827;background:#fff}
.page{page-break-after:always;height:7.6in;overflow:hidden;display:flex;flex-direction:column}
.page:last-child{page-break-after:auto}
.doc-title{font-size:22px;font-weight:700;margin:0 0 8px;text-transform:uppercase;letter-spacing:.02em;flex:0 0 auto}
.title-rule{height:3px;background:#6eb8d4;margin-bottom:12px;flex:0 0 auto}
.overview-grid{flex:1 1 auto;display:grid;grid-template-columns:200px 1fr 1fr;gap:12px;align-items:stretch;min-height:0}
.subjects h2{font-size:11px;font-weight:700;color:#6b7280;margin:0 0 8px}
.subjects ul{list-style:none;margin:0;padding:0;border:1px solid #d1d5db;background:#fafafa}
.subjects .subj-line{margin:0;padding:10px;font-size:10px;line-height:1.35;color:#374151}
.subjects .subj-line.with-rule{border-bottom:1px solid #e5e7eb}
.preview-col{display:flex;flex-direction:column;min-height:0}
.preview-col h3,.section-label{font-size:12px;font-weight:700;margin:0 0 6px;letter-spacing:.04em;flex:0 0 auto}
.preview-fit{flex:1 1 auto;display:flex;align-items:flex-start;justify-content:center;min-height:0;overflow:hidden}
.preview-fit img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;display:block}
.page-full{justify-content:flex-start}
.page-full .preview-fit{flex:1 1 auto;align-items:center}
.page-full .section-label{margin-bottom:8px}
</style></head><body>
<section class="page page-overview">
  <h1 class="doc-title">${escapeHtml(params.emailTitle)}</h1>
  <div class="title-rule"></div>
  <div class="overview-grid">
    <aside class="subjects">
      <h2>Subject Line Options</h2>
      <ul>${subjectLinesHtml(params.subjectLines)}</ul>
    </aside>
    <div class="preview-col desktop-col">
      <h3>DESKTOP</h3>
      <div class="preview-fit">
        <img src="${escapeHtml(params.desktopImageRel)}" alt="Desktop email preview" />
      </div>
    </div>
    <div class="preview-col mobile-col">
      <h3>MOBILE</h3>
      <div class="preview-fit">
        <img src="${escapeHtml(params.mobileImageRel)}" alt="Mobile email preview" />
      </div>
    </div>
  </div>
</section>
<section class="page page-full page-desktop-only">
  <h3 class="section-label">DESKTOP</h3>
  <div class="preview-fit">
    <img src="${escapeHtml(params.desktopImageRel)}" alt="Desktop email preview full" />
  </div>
</section>
<section class="page page-full page-mobile-only">
  <h3 class="section-label">MOBILE</h3>
  <div class="preview-fit">
    <img src="${escapeHtml(params.mobileImageRel)}" alt="Mobile email preview full" />
  </div>
</section>
</body></html>`;
}

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
    // ignore
  }
}

async function waitForCaptureIframe(page: import('playwright').Page) {
  await page.waitForSelector('#email', { state: 'attached', timeout: 30000 });
  await page.waitForTimeout(500);
  try {
    await page.waitForFunction(
      () => {
        const iframe = document.getElementById('email') as HTMLIFrameElement | null;
        if (!iframe?.contentDocument?.body) return false;
        return iframe.contentDocument.body.scrollHeight > 20;
      },
      { timeout: 25000 },
    );
  } catch {
    // continue with best-effort screenshot
  }
  await settleDomImages(page);
  await page.waitForTimeout(300);
}

export type GenerateSubmissionPdfOptions = {
  outputDir: string;
  runId: string;
  publicOutputBaseUrl: string;
  emailTitle: string;
  subjectLines: string[];
  toAddress: string;
  fromAddress: string;
  previewMode: SubmissionPreviewMode;
};

export type GenerateSubmissionPdfResult = {
  submissionPdfPath: string;
  submissionDocumentHtmlPath: string;
  screenshots: { viewport600: string; viewport400: string };
  submissionMeta: {
    emailTitle: string;
    subjectLines: string[];
    toAddress: string;
    fromAddress: string;
    previewMode: SubmissionPreviewMode;
    generatedAt: string;
  };
  warnings: AssemblyWarning[];
};

export async function generateSubmissionPdf(
  options: GenerateSubmissionPdfOptions,
): Promise<GenerateSubmissionPdfResult> {
  const warnings: AssemblyWarning[] = [];
  const emailSrc = await resolveEmailIframeSrc(options.outputDir, options.previewMode, warnings);

  const captureHeader: CaptureHeader = {
    to: options.toAddress,
    from: options.fromAddress,
    subject: options.subjectLines[0] ?? '',
  };

  const shotDir = path.join(options.outputDir, 'screenshots');
  await fs.mkdir(shotDir, { recursive: true });

  await fs.writeFile(
    path.join(options.outputDir, 'submission-capture-600.html'),
    makeCaptureShellHtml(600, captureHeader, emailSrc),
  );
  await fs.writeFile(
    path.join(options.outputDir, 'submission-capture-400.html'),
    makeCaptureShellHtml(400, captureHeader, emailSrc),
  );

  const base = options.publicOutputBaseUrl.replace(/\/+$/, '');
  const desktopPng = path.join(shotDir, 'submission-desktop.png');
  const mobilePng = path.join(shotDir, 'submission-mobile.png');
  const desktopRel = 'screenshots/submission-desktop.png';
  const mobileRel = 'screenshots/submission-mobile.png';

  const playwright = await import('playwright');
  const browser = await playwright.chromium.launch({ headless: true });

  try {
    for (const [variant, fileName, viewportWidth] of [
      ['desktop', 'submission-capture-600.html', 600] as const,
      ['mobile', 'submission-capture-400.html', 400] as const,
    ]) {
      const page = await browser.newPage({ viewport: { width: viewportWidth + 48, height: 900 } });
      await page.goto(`${base}/outputs/${options.runId}/${fileName}`, { waitUntil: 'networkidle', timeout: 60000 });
      await waitForCaptureIframe(page);
      const outPath = variant === 'desktop' ? desktopPng : mobilePng;
      await page.screenshot({ path: outPath, fullPage: true });
      await page.close();
    }

    const docHtml = buildSubmissionDocumentHtml({
      emailTitle: options.emailTitle,
      subjectLines: options.subjectLines,
      desktopImageRel: desktopRel,
      mobileImageRel: mobileRel,
    });
    const docPath = path.join(options.outputDir, 'submission-document.html');
    await fs.writeFile(docPath, docHtml);

    const pdfPath = path.join(options.outputDir, 'submission.pdf');
    const pdfPage = await browser.newPage();
    await pdfPage.goto(`${base}/outputs/${options.runId}/submission-document.html`, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
    await settleDomImages(pdfPage);
    await pdfPage.pdf({
      path: pdfPath,
      format: 'Letter',
      landscape: true,
      printBackground: true,
      margin: { top: '0.28in', right: '0.28in', bottom: '0.28in', left: '0.28in' },
    });
    await pdfPage.close();

    const generatedAt = new Date().toISOString();
    return {
      submissionPdfPath: 'submission.pdf',
      submissionDocumentHtmlPath: 'submission-document.html',
      screenshots: { viewport600: desktopRel, viewport400: mobileRel },
      submissionMeta: {
        emailTitle: options.emailTitle,
        subjectLines: options.subjectLines,
        toAddress: options.toAddress,
        fromAddress: options.fromAddress,
        previewMode: options.previewMode,
        generatedAt,
      },
      warnings,
    };
  } finally {
    await browser.close();
  }
}
