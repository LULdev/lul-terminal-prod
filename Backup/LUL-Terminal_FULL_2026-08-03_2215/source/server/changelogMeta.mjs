/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERSION_FILE = path.join(__dirname, '..', 'src', 'config', 'version.ts');
const CHANGELOG_FILE = path.join(__dirname, '..', 'src', 'data', 'changelog.ts');

let versionCache = null;

/** @returns {string} */
export function getLatestChangelogVersion() {
  try {
    const raw = fs.readFileSync(VERSION_FILE, 'utf8');
    const match = raw.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
    return match?.[1] ?? '0.0.0';
  } catch (err) {
    console.error('[changelog] CRITICAL: version.ts unreadable for achievement sync', err);
    throw new Error('Changelog version unavailable');
  }
}

export async function changelogVersionExists(version) {
  const v = String(version ?? '').trim().slice(0, 48);
  if (!/^\d+\.\d+\.\d+/.test(v)) return false;
  if (!versionCache) {
    const raw = await fsPromises.readFile(CHANGELOG_FILE, 'utf8');
    versionCache = new Set(
      [...raw.matchAll(/version:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]),
    );
  }
  return versionCache.has(v);
}