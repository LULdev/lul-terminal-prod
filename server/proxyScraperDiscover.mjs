/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Discover proxy list URLs inside HTML / GitHub pages.
 */

const LIST_EXT = /\.(txt|csv|json|xml|dat|tsv)(?:\?|#|$)/i;
const RAW_GH = /raw\.githubusercontent\.com/i;
const PROXY_PATH = /proxy|socks|http|list|download|export|api|feed|data/i;
const CDN_PATH = /jsdelivr\.net|cdn\.|raw\.github/i;

export function absolutizeUrl(href, baseUrl) {
  try {
    if (!href || href.startsWith('data:') || href.startsWith('javascript:')) return null;
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

/** Extract .txt/.csv/.json links and raw GitHub URLs from HTML. */
export function discoverListUrls(html, baseUrl, { limit = 12 } = {}) {
  const found = new Set();
  const patterns = [
    /href=["']([^"']+)["']/gi,
    /src=["']([^"']+)["']/gi,
    /(https?:\/\/raw\.githubusercontent\.com\/[^\s"'<>]+)/gi,
    /(https?:\/\/[^\s"'<>]+\.(?:txt|csv|json|xml))/gi,
  ];

  for (const re of patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(html)) !== null) {
      const raw = m[1] ?? m[0];
      const abs = absolutizeUrl(raw, baseUrl);
      if (!abs) continue;
      if (
        LIST_EXT.test(abs)
        || RAW_GH.test(abs)
        || CDN_PATH.test(abs)
        || (PROXY_PATH.test(abs) && /api|download|export|get|txt|csv|json|feed|data/i.test(abs))
      ) {
        found.add(abs.split('#')[0]);
      }
    }
  }

  return [...found].slice(0, limit);
}

/** Pull JSON arrays/objects from inline <script> blocks. */
export function extractScriptJsonBlobs(html) {
  const blobs = [];
  const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of scripts) {
    const inner = block.replace(/<\/?script[^>]*>/gi, '');
    const candidates = [
      inner.match(/(\[[\s\S]{10,800000}?\])/),
      inner.match(/(\{[\s\S]{10,800000}?"(?:proxies|data|list|results)"[\s\S]*?\})/),
      inner.match(/(?:var|let|const)\s+\w+\s*=\s*(\[[\s\S]{10,500000}?\]);/),
      inner.match(/(?:var|let|const)\s+\w+\s*=\s*(\{[\s\S]{10,500000}?\});/),
      inner.match(/JSON\.parse\(\s*['"`]([\s\S]{20,200000}?)['"`]\s*\)/),
      inner.match(/fetch\(\s*['"`]([^'"`]+(?:proxy|socks|list|download)[^'"`]*)['"`]/i),
    ];
    for (const c of candidates) {
      if (c?.[1]) blobs.push(c[1]);
    }
  }
  return blobs;
}

/** Extract ip:port strings from JS string arrays: ["1.2.3.4:8080", ...] */
export function extractJsStringArrayProxies(html) {
  const found = [];
  const re = /\[((?:\s*['"][\d.]+:\d{2,5}['"]\s*,?)+)\]/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const items = m[1].match(/['"]([\d.]+:\d{2,5})['"]/g) ?? [];
    for (const item of items) {
      const inner = item.replace(/['"]/g, '');
      if (inner) found.push(inner);
    }
  }
  return found;
}

export function extractDataAttributes(html) {
  const pairs = [];
  const re = /data-(?:ip|host|address)=["']([^"']+)["'][^>]*data-port=["'](\d{2,5})["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    pairs.push({ host: m[1], port: parseInt(m[2], 10) });
  }
  const re2 = /data-port=["'](\d{2,5})["'][^>]*data-(?:ip|host)=["']([^"']+)["']/gi;
  while ((m = re2.exec(html)) !== null) {
    pairs.push({ host: m[2], port: parseInt(m[1], 10) });
  }
  return pairs;
}