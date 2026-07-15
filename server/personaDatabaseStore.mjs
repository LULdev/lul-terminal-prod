/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', 'data', 'persona-database');
const DB_FILE = path.join(ROOT, 'entries.json');

const EMPTY_DB = {
  version: 1,
  updatedAt: null,
  count: 0,
  entries: [],
};

let cache = null;

export async function loadPersonaDb() {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    const data = JSON.parse(raw);
    cache = {
      ...EMPTY_DB,
      ...data,
      entries: Array.isArray(data.entries) ? data.entries : [],
    };
    return cache;
  } catch (err) {
    console.error('[persona-db] CRITICAL: entries.json unreadable', err);
    throw new Error('Persona database unavailable');
  }
}

export function clearPersonaDbCache() {
  cache = null;
}

export async function getPersonaStats() {
  const db = await loadPersonaDb();
  const byCountry = {};
  for (const entry of db.entries) {
    byCountry[entry.country] = (byCountry[entry.country] ?? 0) + 1;
  }
  return {
    total: db.entries.length,
    countries: Object.keys(byCountry).sort(),
    byCountry,
    updatedAt: db.updatedAt,
  };
}

export async function listCountries() {
  const stats = await getPersonaStats();
  return stats.countries.map((country) => ({
    country,
    count: stats.byCountry[country] ?? 0,
  }));
}

export async function pickRandomEntry(country) {
  const db = await loadPersonaDb();
  const pool = country
    ? db.entries.filter((e) => e.country === country)
    : db.entries;
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function listPersonaEntries({ limit = 120, country, q } = {}) {
  const cap = Math.min(300, Math.max(1, Number(limit) || 120));
  const db = await loadPersonaDb();
  let list = [...db.entries];

  if (country) {
    list = list.filter((e) => e.country === country);
  }
  if (q) {
    const needle = String(q).toLowerCase();
    list = list.filter(
      (e) =>
        (e.id ?? '').toLowerCase().includes(needle) ||
        (e.country ?? '').toLowerCase().includes(needle) ||
        (e.city ?? '').toLowerCase().includes(needle) ||
        (e.street ?? '').toLowerCase().includes(needle) ||
        (e.venue ?? '').toLowerCase().includes(needle) ||
        (e.address ?? '').toLowerCase().includes(needle),
    );
  }

  const total = list.length;
  const entries = list.slice(0, cap).map((e) => ({
    id: e.id,
    country: e.country,
    city: e.city,
    street: e.street,
    zip: e.zip ?? null,
    timezone: e.timezone ?? null,
    venue: e.venue ?? null,
    address: e.address ?? null,
  }));

  return { entries, total };
}