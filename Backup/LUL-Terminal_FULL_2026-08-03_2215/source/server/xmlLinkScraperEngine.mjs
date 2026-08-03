/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const LINK_ATTRS = new Set([
  'href', 'src', 'url', 'link', 'loc', 'uri', 'ref', 'source', 'target',
  'xlink:href', 'schemaLocation', 'xsi:schemaLocation', 'base', 'canonical',
]);

const URL_RE = /(?:https?|ftp|ws|wss|mailto|tel|file):\/\/[^\s<>"']+/gi;
const GENERIC_COLON_RE = /[a-zA-Z][a-zA-Z0-9+.-]*:[^\s<>"']+/g;

/** Convert wildcard pattern (* = any) to RegExp. Empty pattern matches all extracted values. */
export function patternToRegex(pattern) {
  const raw = String(pattern ?? '').trim();
  if (!raw || raw === '*') return null;
  const escaped = raw.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

export function valueMatchesPattern(value, pattern) {
  const re = patternToRegex(pattern);
  if (!re) return true;
  return re.test(String(value).trim());
}

function decodeXmlEntities(text) {
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripTags(text) {
  return decodeXmlEntities(text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function lineNumberAt(xml, index) {
  let line = 1;
  for (let i = 0; i < index && i < xml.length; i++) {
    if (xml[i] === '\n') line++;
  }
  return line;
}

function pathAt(xml, index) {
  const before = xml.slice(0, index);
  const openTags = [];
  const tagRe = /<\/?([a-zA-Z][\w:.-]*)(?:\s[^>]*)?\s*\/?>/g;
  let m;
  while ((m = tagRe.exec(before)) !== null) {
    const full = m[0];
    const name = m[1];
    if (full.startsWith('</')) {
      const idx = openTags.lastIndexOf(name);
      if (idx >= 0) openTags.splice(idx);
    } else if (!full.endsWith('/>')) {
      openTags.push(name);
    }
  }
  return openTags.join('/') || 'document';
}

function pushMatch(matches, seen, entry) {
  const key = `${entry.value}\0${entry.path}\0${entry.attribute ?? ''}`;
  if (seen.has(key)) return;
  seen.add(key);
  matches.push(entry);
}

function extractAttributeValues(xml) {
  const out = [];
  const attrRe = /([a-zA-Z][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = attrRe.exec(xml)) !== null) {
    const name = m[1];
    const value = decodeXmlEntities(m[3] ?? m[4] ?? '').trim();
    if (!value) continue;
    out.push({
      value,
      attribute: name,
      index: m.index,
      isLinkAttr: LINK_ATTRS.has(name.toLowerCase()) || LINK_ATTRS.has(name),
    });
  }
  return out;
}

function extractTextAndCdata(xml) {
  const out = [];
  const cdataRe = /<!\[CDATA\[([\s\S]*?)\]\]>/g;
  let m;
  while ((m = cdataRe.exec(xml)) !== null) {
    const value = m[1].trim();
    if (value) out.push({ value, source: 'cdata', index: m.index + 12 });
  }

  const textRe = />([^<]+)</g;
  while ((m = textRe.exec(xml)) !== null) {
    const value = stripTags(m[1]);
    if (value.length >= 3) out.push({ value, source: 'text', index: m.index + 1 });
  }
  return out;
}

function extractUrlCandidates(value) {
  const found = new Set();
  const urls = value.match(URL_RE) ?? [];
  for (const u of urls) found.add(u);
  if (value.includes(':')) {
    const colon = value.match(GENERIC_COLON_RE) ?? [];
    for (const u of colon) {
      if (!/:\/\//.test(u)) found.add(u);
    }
  }
  if (/^[^\s<>"']+$/.test(value) && (value.includes('.') || value.includes('/'))) {
    found.add(value);
  }
  return [...found];
}

function parseDomain(value) {
  try {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) {
      return new URL(value).hostname || null;
    }
  } catch { /* ignore */ }
  return null;
}

function parseProtocol(value) {
  const m = String(value).match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  return m ? m[1].toLowerCase() : 'other';
}

/**
 * Scan XML for values matching a wildcard pattern (e.g. *:*, https://*, *).
 */
export function scanXmlLinks({ xml, pattern = '*:*', mode = 'smart' } = {}) {
  const started = Date.now();
  const text = String(xml ?? '').trim();
  if (!text) throw new Error('XML content is empty');
  if (!text.includes('<')) throw new Error('Input does not look like XML');

  const matches = [];
  const seen = new Set();
  const attrs = extractAttributeValues(text);
  const texts = extractTextAndCdata(text);
  let stringsScanned = 0;

  for (const item of attrs) {
    stringsScanned++;
    const candidates = mode === 'raw'
      ? [item.value]
      : mode === 'urls'
        ? extractUrlCandidates(item.value)
        : [...new Set([item.value, ...extractUrlCandidates(item.value)])];

    for (const candidate of candidates) {
      if (!valueMatchesPattern(candidate, pattern)) continue;
      pushMatch(matches, seen, {
        value: candidate,
        path: pathAt(text, item.index),
        source: 'attribute',
        attribute: item.attribute,
        line: lineNumberAt(text, item.index),
        isLinkAttr: item.isLinkAttr,
      });
    }
  }

  for (const item of texts) {
    stringsScanned++;
    const candidates = mode === 'raw'
      ? [item.value]
      : [...new Set([...extractUrlCandidates(item.value), item.value])];

    for (const candidate of candidates) {
      if (candidate.length < 3) continue;
      if (!valueMatchesPattern(candidate, pattern)) continue;
      pushMatch(matches, seen, {
        value: candidate,
        path: pathAt(text, item.index),
        source: item.source,
        line: lineNumberAt(text, item.index),
        isLinkAttr: false,
      });
    }
  }

  const domainMap = new Map();
  const protocolMap = new Map();
  for (const m of matches) {
    const proto = parseProtocol(m.value);
    protocolMap.set(proto, (protocolMap.get(proto) ?? 0) + 1);
    const domain = parseDomain(m.value);
    if (domain) domainMap.set(domain, (domainMap.get(domain) ?? 0) + 1);
  }

  const domains = [...domainMap.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count);

  const uniqueValues = new Set(matches.map((m) => m.value));

  return {
    pattern: String(pattern).trim() || '*',
    mode,
    stats: {
      xmlSize: text.length,
      stringsScanned,
      totalMatches: matches.length,
      uniqueMatches: uniqueValues.size,
      domains: domains.length,
      attributeHits: matches.filter((m) => m.source === 'attribute').length,
      textHits: matches.filter((m) => m.source === 'text').length,
      cdataHits: matches.filter((m) => m.source === 'cdata').length,
      protocols: Object.fromEntries(protocolMap),
    },
    domains,
    matches: matches.sort((a, b) => a.line - b.line || a.path.localeCompare(b.path)),
    scanMs: Date.now() - started,
  };
}

export const PATTERN_PRESETS = [
  { id: 'colon', label: 'Protocol / colon', pattern: '*:*', hint: 'Matches values with a colon (http://…, mailto:…, key:value)' },
  { id: 'http', label: 'HTTP(S)', pattern: 'http*', hint: 'Starts with http (http:// or https://)' },
  { id: 'https', label: 'HTTPS only', pattern: 'https://*', hint: 'HTTPS URLs only' },
  { id: 'scheme', label: 'Any scheme', pattern: '*://*', hint: 'Anything with ://' },
  { id: 'mailto', label: 'Mailto', pattern: 'mailto:*', hint: 'Email links' },
  { id: 'all', label: 'All values', pattern: '*', hint: 'Every extracted string / URL candidate' },
];