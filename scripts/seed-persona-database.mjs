/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Seeds persona-database/entries.json from ADDRESS_POOL (250 real public addresses).
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ADDRESS_POOL } from './persona-address-pool.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'data', 'persona-database', 'entries.json');

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function buildEntries() {
  const seen = new Set();

  return ADDRESS_POOL.map((item, index) => {
    const address = `${item.street}, ${item.zip} ${item.city}, ${item.country}`;
    let id = `persona-addr-${String(index + 1).padStart(3, '0')}`;
    const slug = slugify(`${item.country}-${item.city}-${item.venue}`);
    if (slug) id = `${id}-${slug}`.slice(0, 80);

    if (seen.has(id)) {
      throw new Error(`Duplicate entry id: ${id}`);
    }
    seen.add(id);

    return {
      id,
      country: item.country,
      city: item.city,
      street: item.street,
      zip: item.zip,
      address,
      timezone: item.timezone,
      venue: item.venue,
    };
  });
}

const entries = buildEntries();

if (entries.length !== 250) {
  console.error('Expected 250 entries, got', entries.length);
  process.exit(1);
}

const byCountry = {};
for (const entry of entries) {
  byCountry[entry.country] = (byCountry[entry.country] ?? 0) + 1;
}

const payload = {
  version: 1,
  updatedAt: new Date().toISOString(),
  count: entries.length,
  entries,
};

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(payload, null, 2), 'utf8');

console.log('Wrote', OUT, 'with', entries.length, 'entries');
console.log('Per country:', byCountry);