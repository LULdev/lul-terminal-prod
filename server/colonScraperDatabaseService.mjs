/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  deleteColonEntry,
  getColonDbStats,
  loadColonDb,
  upsertColonEntries,
} from './colonScraperDatabaseStore.mjs';

/** Flatten colon atlas entries into U/P/Website rows (one per unique site per token). */
export function atlasToDbItems(atlas, fallbackWebsite = '') {
  const items = [];

  for (const entry of atlas ?? []) {
    const tokenValue = typeof entry === 'string' ? entry : entry?.value;
    if (!tokenValue || !String(tokenValue).includes(':')) continue;

    const pages = entry.pages ?? [];
    if (!pages.length && fallbackWebsite) {
      items.push({ value: tokenValue, website: fallbackWebsite });
      continue;
    }

    const siteSet = new Set();
    for (const page of pages) {
      const website = page.siteName || fallbackWebsite;
      if (!website || siteSet.has(website)) continue;
      siteSet.add(website);
      items.push({
        value: tokenValue,
        website,
        sourceUrl: page.url ?? null,
      });
    }
  }

  return items;
}

/** Flatten XML link matches — use provided website label or domain from URL. */
export function xmlMatchesToDbItems(matches, website = 'xml-scan') {
  const items = [];
  for (const m of matches ?? []) {
    if (!m.value?.includes(':')) continue;
    let site = website;
    try {
      if (/^https?:\/\//i.test(m.value)) site = new URL(m.value).hostname;
    } catch { /* keep default */ }
    items.push({ value: m.value, website: site, sourceUrl: m.path ?? null });
  }
  return items;
}

export async function saveAtlasToDatabase(atlas, fallbackWebsite = '') {
  const items = atlasToDbItems(atlas, fallbackWebsite);
  return upsertColonEntries(items);
}

export async function saveXmlMatchesToDatabase(matches, website = 'xml-scan') {
  const items = xmlMatchesToDbItems(matches, website);
  return upsertColonEntries(items);
}

export async function listColonDbEntries({ limit = 100, website, q } = {}) {
  const db = await loadColonDb();
  let list = [...db.entries];

  if (website) {
    list = list.filter((e) => (e.Website ?? '').toLowerCase() === website.toLowerCase());
  }
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter(
      (e) =>
        (e.U ?? '').toLowerCase().includes(needle) ||
        (e.P ?? '').toLowerCase().includes(needle) ||
        (e.Website ?? '').toLowerCase().includes(needle) ||
        (e.sourceValue ?? '').toLowerCase().includes(needle),
    );
  }

  list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const total = list.length;
  return { entries: list.slice(0, Math.min(500, Math.max(1, limit))), total };
}

export { deleteColonEntry, getColonDbStats };