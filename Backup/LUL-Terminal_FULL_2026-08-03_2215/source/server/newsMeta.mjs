/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NEWS_FILE = path.join(__dirname, '..', 'data', 'feeds', 'news.json');

/** Sync read for achievement sync — mirrors newsStore feedVersion. */
export function getLatestNewsVersion() {
  if (!fs.existsSync(NEWS_FILE)) return '0.0.0';
  try {
    const raw = fs.readFileSync(NEWS_FILE, 'utf8');
    const data = JSON.parse(raw);
    return String(data.feedVersion ?? '0.0.0').slice(0, 32);
  } catch (err) {
    console.error('[news] CRITICAL: news.json unreadable for achievement sync', err);
    throw new Error('News feed unavailable');
  }
}