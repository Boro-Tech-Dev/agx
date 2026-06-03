#!/usr/bin/env node
/**
 * Generate public/brand/ragtag-stack.webp from ragtag-stack.png (hero, <~150KB target).
 * Usage: node scripts/optimize-brand-hero.mjs
 * Requires: npm install sharp (dev) in apps/web-dashboard, or sharp on NODE_PATH.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brandDir = path.join(root, 'apps/web-dashboard/public/brand');
const input = path.join(brandDir, 'ragtag-stack.png');
const output = path.join(brandDir, 'ragtag-stack.webp');

const sharpPkg = path.join(root, 'apps/web-dashboard/node_modules/sharp');
let sharp;
try {
  sharp = (await import(pathToFileURL(path.join(sharpPkg, 'lib/index.js')).href)).default;
} catch {
  console.error('Install sharp: cd apps/web-dashboard && npm install --save-dev sharp');
  process.exit(1);
}

await mkdir(brandDir, { recursive: true });
const info = await sharp(input)
  .webp({ quality: 82, effort: 6 })
  .toFile(output);

console.log(`Wrote ${output} (${info.size} bytes)`);
