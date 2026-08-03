/**
 * Deduplicate existing public/memes/catalog.json without re-scraping.
 * Run: node scripts/dedupe-meme-catalog.mjs
 */

import { readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { buildCatalogMeta, deduplicateMemeTemplates } from './meme-dedup.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG = join(__dirname, '../public/memes/catalog.json');

async function main() {
  const raw = JSON.parse(await readFile(CATALOG, 'utf8'));
  const before = raw.templates.length;
  const deduped = deduplicateMemeTemplates(raw.templates);
  const removed = before - deduped.length;

  const catalog = buildCatalogMeta(deduped, {
    scrapedAt: new Date().toISOString(),
    source: raw.source ?? 'imgflip.com',
    staticPages: raw.staticPages ?? '2-50',
    gifPages: raw.gifPages ?? '2-169',
    duplicatesRemoved: (raw.duplicatesRemoved ?? 0) + removed,
  });

  await writeFile(CATALOG, JSON.stringify(catalog));
  console.log(`Deduped: ${before} → ${catalog.total} (removed ${removed})`);
  console.log(`  Static: ${catalog.staticCount}`);
  console.log(`  GIF:    ${catalog.gifCount}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});