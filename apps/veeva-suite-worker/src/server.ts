import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { z } from 'zod';
import {
  assembleVeevaZip,
  discoverRteTokensFromZip,
  generateSubmissionPdf,
  outputsRoot,
  refreshSuiteOutputZip,
  suiteDownloadHref,
} from '@agent-x/veeva-suite-core';

const app = express();
const port = Number(process.env.PORT || 4317);
const storageDir = process.env.STORAGE_DIR || path.resolve(process.cwd(), 'storage');
const uploadsDir = path.join(storageDir, 'uploads');
const outputsDir = path.join(storageDir, 'outputs');
const workDir = path.join(storageDir, 'work');
const webPathPrefix = (process.env.WEB_PATH_PREFIX || '').trim();
const publicOutputBaseUrl = (process.env.PUBLIC_OUTPUT_BASE_URL || `http://127.0.0.1:${port}`).trim().replace(/\/+$/, '');
const defaultScreenshots = process.env.ENABLE_SCREENSHOTS === 'true';

await fs.mkdir(uploadsDir, { recursive: true });
await fs.mkdir(outputsDir, { recursive: true });
await fs.mkdir(workDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: Number(process.env.MAX_UPLOAD_BYTES || 80 * 1024 * 1024) },
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.zip')) cb(new Error('Only .zip files are supported.'));
    else cb(null, true);
  },
});

app.use(cors());
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use('/outputs', express.static(outputsDir, { fallthrough: false }));
// Generated RTE/CLM HTML embeds `WEB_PATH_PREFIX` (e.g. `/api/veeva-suite/outputs/:id/...`). Playwright
// screenshots use PUBLIC_OUTPUT_BASE_URL against this worker, so those absolute paths must resolve here too.
if (webPathPrefix) {
  app.use(`${webPathPrefix.replace(/\/+$/, '')}/outputs`, express.static(outputsDir, { fallthrough: false }));
}

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, service: 'veeva-suite-worker', supports: ['rte', 'clm', 'submission-pdf'] }),
);

app.post('/api/suite-runs/tokens', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Upload a Veeva RTE or CLM .zip using the field name "file".' });
    const out = await discoverRteTokensFromZip({
      sourceZipPath: req.file.path,
      workBaseDir: workDir,
    });
    await fs.rm(req.file.path, { force: true });
    res.json(out);
  } catch (error) {
    if (req.file?.path) await fs.rm(req.file.path, { force: true });
    next(error);
  }
});

app.post('/api/suite-runs', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Upload a Veeva RTE or CLM .zip file using the field name "file".' });
    const bodySchema = z.object({ tokenMap: z.string().optional(), screenshots: z.string().optional() });
    const parsed = bodySchema.parse(req.body);
    const tokenMap = parsed.tokenMap ? JSON.parse(parsed.tokenMap) : undefined;
    const enableScreenshots = parsed.screenshots ? parsed.screenshots === 'true' : defaultScreenshots;
    const result = await assembleVeevaZip({
      sourceZipPath: req.file.path,
      outputBaseDir: outputsDir,
      workBaseDir: workDir,
      webPathPrefix,
      tokenMap,
      enableScreenshots,
      publicOutputBaseUrl: enableScreenshots ? publicOutputBaseUrl : undefined,
    });
    await fs.rm(req.file.path, { force: true });
    res.json(toClientResult(result.id, result, webPathPrefix));
  } catch (error) {
    if (req.file?.path) await fs.rm(req.file.path, { force: true });
    next(error);
  }
});

app.get('/api/suite-runs/:id', async (req, res) => {
  const manifestPath = path.join(outputsDir, req.params.id, 'manifest.json');
  try {
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    res.json(toClientResult(req.params.id, manifest, webPathPrefix));
  } catch {
    res.status(404).json({ error: 'Suite run not found.' });
  }
});

const submissionBodySchema = z.object({
  emailTitle: z.string().trim().min(1).max(120),
  subjectLines: z.array(z.string().max(240)).min(1).max(12),
  toAddress: z.string().trim().min(1).max(200),
  fromAddress: z.string().trim().min(1).max(200),
  previewMode: z.enum(['tokens', 'processed']).optional().default('processed'),
});

app.post('/api/suite-runs/:id/submission', async (req, res, next) => {
  try {
    const runId = req.params.id;
    const outputDir = path.join(outputsDir, runId);
    try {
      await fs.access(outputDir);
    } catch {
      return res.status(404).json({ error: 'Suite run not found.' });
    }

    const manifestPath = path.join(outputDir, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    if (manifest.packageType !== 'rte') {
      return res.status(400).json({
        error: 'Submission PDFs are only available for RTE (email) packages. Upload a Veeva RTE/VAE ZIP.',
      });
    }

    const parsed = submissionBodySchema.parse(req.body);
    const subjectLines = parsed.subjectLines.map((s) => s.trim()).filter(Boolean);
    if (!subjectLines.length) {
      return res.status(400).json({ error: 'Enter at least one subject line.' });
    }

    const submission = await generateSubmissionPdf({
      outputDir,
      runId,
      publicOutputBaseUrl,
      emailTitle: parsed.emailTitle.trim(),
      subjectLines,
      toAddress: parsed.toAddress.trim(),
      fromAddress: parsed.fromAddress.trim(),
      previewMode: parsed.previewMode,
    });

    const screenshots = (manifest.screenshots as Record<string, unknown>) || {};
    manifest.screenshots = {
      ...screenshots,
      viewport600: submission.screenshots.viewport600,
      viewport400: submission.screenshots.viewport400,
    };
    manifest.submissionPdfPath = submission.submissionPdfPath;
    manifest.submissionMeta = submission.submissionMeta;
    const warnings = Array.isArray(manifest.warnings) ? [...manifest.warnings] : [];
    manifest.warnings = [...warnings, ...submission.warnings];
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    await refreshSuiteOutputZip(outputDir);

    res.json(toClientResult(runId, manifest, webPathPrefix));
  } catch (error) {
    next(error);
  }
});

app.get('/api/suite-runs/:id/download', async (req, res) => {
  const zipPath = path.join(outputsDir, req.params.id, 'veeva-suite-output.zip');
  try {
    await fs.access(zipPath);
    res.download(zipPath, `veeva-suite-${req.params.id}.zip`);
  } catch {
    res.status(404).json({ error: 'Suite output ZIP not found.' });
  }
});

function toClientResult(id: string, result: Record<string, unknown>, prefix: string) {
  const previewFile =
    result.packageType === 'clm' || result.previewHtmlPath === 'clm-preview.html'
      ? 'clm-preview.html'
      : (result.previewHtmlPath as string) || 'rte-preview.html';
  const root = outputsRoot(prefix, id);
  return {
    id,
    packageType: result.packageType,
    sourceName: result.sourceName,
    fragmentCount: result.fragmentCount || 0,
    slideCount: result.slideCount || 0,
    fragments: result.fragments || [],
    slides: result.slides || [],
    navigation: result.navigation || [],
    warnings: result.warnings || [],
    inventory: result.inventory || [],
    screenshots: result.screenshots || { fragments: [], slides: [] },
    previewUrl: `${root}/${previewFile}`,
    assembledHtmlUrl: result.assembledHtmlPath ? `${root}/${result.assembledHtmlPath}` : undefined,
    assembledHtmlProcessedUrl:
      result.packageType === 'rte' && result.assembledHtmlPath
        ? `${root}/assembled-email-processed.html`
        : undefined,
    assembledHtmlTokensUrl:
      result.packageType === 'rte' && result.assembledHtmlPath ? `${root}/assembled-email-tokens.html` : undefined,
    reportHtmlUrl: `${root}/review-report.html`,
    reportPdfUrl: result.reportPdfPath ? `${root}/${result.reportPdfPath}` : undefined,
    submissionPdfUrl: result.submissionPdfPath ? `${root}/${result.submissionPdfPath}` : undefined,
    submissionMeta: result.submissionMeta,
    manifestUrl: `${root}/manifest.json`,
    downloadUrl: suiteDownloadHref(prefix, id),
  };
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(400).json({ error: err.message || 'Unable to process this package.' });
});

app.listen(port, () => console.log(`veeva-suite-worker listening on http://0.0.0.0:${port}`));
