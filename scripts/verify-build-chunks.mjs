#!/usr/bin/env node
/**
 * Fail the build when the main entry chunk is still monolithic (pre–code-split).
 */
import fs from 'node:fs';
import path from 'node:path';

const distAssets = path.join(process.cwd(), 'dist', 'assets');
const MAX_INDEX_KB = 520;
const WARN_ANY_KB = 500;

if (!fs.existsSync(distAssets)) {
  console.error('[verify-build-chunks] dist/assets missing — run vite build first');
  process.exit(1);
}

const files = fs.readdirSync(distAssets).filter((f) => f.endsWith('.js'));
const indexFiles = files.filter((f) => /^index-/.test(f));

if (indexFiles.length === 0) {
  console.error('[verify-build-chunks] no index-*.js chunk found');
  process.exit(1);
}

let failed = false;

for (const file of files) {
  const sizeKb = fs.statSync(path.join(distAssets, file)).size / 1024;
  if (sizeKb > WARN_ANY_KB) {
    const level = /^index-/.test(file) && sizeKb > MAX_INDEX_KB ? 'ERROR' : 'warn';
    const line = `[verify-build-chunks] ${level}: ${file} ${sizeKb.toFixed(1)} kB`;
    if (level === 'ERROR') {
      console.error(line);
      failed = true;
    } else {
      console.warn(line);
    }
  }
}

const vendorCount = files.filter((f) => f.startsWith('vendor-')).length;
const pageChunks = files.filter((f) => /Page-/.test(f)).length;

console.log(
  `[verify-build-chunks] ${files.length} JS chunks (${vendorCount} vendor, ${pageChunks} pages); `
  + `index: ${indexFiles.map((f) => `${f} (${(fs.statSync(path.join(distAssets, f)).size / 1024).toFixed(1)} kB)`).join(', ')}`,
);

if (failed) {
  console.error(
    '[verify-build-chunks] Main bundle too large — ensure App imports pages from lazyPages, '
    + 'not components/pages/index static exports. Run: git pull && rm -rf dist node_modules/.vite && npm run build',
  );
  process.exit(1);
}