/**
 * Scrapes imgflip meme + gif template pages into public/memes/catalog.json
 * Run: node scripts/scrape-imgflip-memes.mjs
 */

import { writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { buildCatalogMeta, canonicalMemeKey, deduplicateMemeTemplates } from './meme-dedup.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../public/memes');
const OUT_FILE = join(OUT_DIR, 'catalog.json');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizeUrl(url) {
  if (!url) return '';
  return url.startsWith('//') ? `https:${url}` : url;
}

function parseBoxes(html, linkPrefix, type) {
  const items = [];
  const seen = new Set();
  const boxes = html.split('<div class="mt-box">').slice(1);

  for (const box of boxes) {
    const linkMatch = box.match(new RegExp(`href="/${linkPrefix}/([^"]+)"[^>]*>([^<]+)<`));
    const imgMatch = box.match(/src="(\/\/i\.imgflip\.com\/[^"]+)"/);
    if (!linkMatch || !imgMatch) continue;

    const path = linkMatch[1].trim();
    const name = linkMatch[2].trim();
    const preview = normalizeUrl(imgMatch[1]);
    const key = path.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const numericId = path.match(/^(\d+)\//)?.[1] ?? path.replace(/[^a-zA-Z0-9-]/g, '-');
    const mediaUrl =
      type === 'gif' && preview.includes('/2/')
        ? preview.replace(/\.jpg$/i, '.gif')
        : preview;

    items.push({
      id: `${type === 'gif' ? 'gif' : 'img'}-${numericId}`,
      name,
      path,
      type,
      previewUrl: preview,
      mediaUrl,
    });
  }
  return items;
}

function parseStaticMemes(html) {
  return parseBoxes(html, 'meme', 'image');
}

function parseGifMemes(html) {
  return parseBoxes(html, 'memetemplate', 'gif');
}

async function fetchPage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function scrapeRange(baseUrl, startPage, endPage, parser, label) {
  const all = [];
  const seen = new Set();

  for (let page = startPage; page <= endPage; page++) {
    const url = page === 1 ? baseUrl.replace(/\?page=\d+/, '') : `${baseUrl}?page=${page}`;
    const pageUrl = page === 1 && !baseUrl.includes('page=') ? baseUrl : `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${page}`;
    const finalUrl =
      page === 1
        ? baseUrl.includes('memetemplates')
          ? 'https://imgflip.com/memetemplates'
          : 'https://imgflip.com/gif-templates'
        : `${baseUrl.split('?')[0]}?page=${page}`;

    try {
      process.stdout.write(`\r[${label}] page ${page}/${endPage}...`);
      const html = await fetchPage(finalUrl);
      const batch = parser(html).map((t) => ({ ...t, sourcePage: page }));
      for (const item of batch) {
        const key = canonicalMemeKey(item);
        if (seen.has(key)) continue;
        seen.add(key);
        all.push(item);
      }
    } catch (err) {
      console.error(`\nWarn ${finalUrl}: ${err.message}`);
    }
    await sleep(280);
  }
  console.log(`\n[${label}] done: ${all.length} templates`);
  return all;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log('=== Imgflip Meme Scraper ===');

  const staticMemes = await scrapeRange(
    'https://imgflip.com/memetemplates',
    2,
    50,
    parseStaticMemes,
    'STATIC'
  );

  const gifMemes = await scrapeRange(
    'https://imgflip.com/gif-templates',
    2,
    169,
    parseGifMemes,
    'GIF'
  );

  const merged = [...staticMemes, ...gifMemes];
  const before = merged.length;
  const deduped = deduplicateMemeTemplates(merged);
  const removed = before - deduped.length;

  const catalog = buildCatalogMeta(deduped, {
    scrapedAt: new Date().toISOString(),
    source: 'imgflip.com',
    staticPages: '2-50',
    gifPages: '2-169',
    duplicatesRemoved: removed,
  });

  await writeFile(OUT_FILE, JSON.stringify(catalog));
  console.log(`\nSaved ${catalog.total} templates → ${OUT_FILE}`);
  console.log(`  Static: ${catalog.staticCount}`);
  console.log(`  GIF:    ${catalog.gifCount}`);
  if (removed > 0) console.log(`  Dedup:  ${removed} duplicates removed (GIF preferred)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});