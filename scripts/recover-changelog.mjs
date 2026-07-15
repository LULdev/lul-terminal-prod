/**
 * Recover changelog.ts from session transcript (pre-corruption snapshot).
 */
import fs from 'fs';
import readline from 'readline';

const TRANSCRIPT =
  'C:/Users/LUL/.grok/sessions/C%3A%5CUsers%5CLUL/019f2223-1afb-72e2-89c5-1bd1249deb08/updates.jsonl';
const OUT = 'C:/Users/LUL/Downloads/lul-terminal (1)/src/data/changelog.recovered.ts';

const ICON_TO_PRIORITY = {
  '🔴': 'P0',
  '🟠': 'P1',
  '🟡': 'P2',
  '🔵': 'P3',
  '🩵': 'P4',
  '💜': 'P5',
  '🟣': 'P6',
  '🩷': 'P7',
  '⚪': 'P8',
  '🟢': 'P9',
};

function isValidChangelog(text) {
  if (!text.startsWith('/**') && !text.startsWith('export ')) return false;
  if (text.includes('[object Object]')) return false;
  if (text.includes('{"type":')) return false;
  if (text.includes('tool_call_id')) return false;
  if (!text.includes('export const CHANGELOG')) return false;
  if (!text.trimEnd().endsWith('];')) return false;
  return true;
}

function extractFromLine(obj) {
  const content = obj?.params?.update?.content;
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    const text = block?.content?.content?.text ?? block?.content?.text;
    if (typeof text === 'string' && text.includes('export const CHANGELOG')) {
      return text;
    }
  }
  return null;
}

function upgradeTypesAndItems(source) {
  const header = `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChangelogPriority } from './changelogPriority';

export type { ChangelogPriority };

export type ChangelogItem = {
  priority?: ChangelogPriority;
  icon?: string;
  text: string;
};

export type ChangelogEntry = {
  version: string;
  title: string;
  date: string;
  highlight?: boolean;
  items: ChangelogItem[];
};

`;

  let body = source
    .replace(/^\/\*\*[\s\S]*?export type ChangelogEntry[\s\S]*?};\s*/m, '')
    .trim();

  body = body.replace(
    /\{\s*icon:\s*'([^']+)',\s*text:\s*'(P\d[^']*)'\s*\}/g,
    (_m, icon, text) => {
      const priority = ICON_TO_PRIORITY[icon] ?? text.match(/^(P\d)/)?.[1];
      if (priority) return `{ priority: '${priority}', text: '${text}' }`;
      return `{ icon: '${icon}', text: '${text}' }`;
    },
  );

  return header + body + '\n';
}

async function main() {
  const targetLine = Number(process.argv[2] || 0);
  const rl = readline.createInterface({
    input: fs.createReadStream(TRANSCRIPT, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let lineNo = 0;
  let best = null;
  let bestVersions = 0;
  let bestLine = 0;

  for await (const line of rl) {
    lineNo++;
    if (targetLine && lineNo !== targetLine) continue;
    if (!targetLine && !line.includes('changelog.ts')) continue;
    try {
      const obj = JSON.parse(line);
      const text = extractFromLine(obj);
      if (!text || !isValidChangelog(text)) continue;
      const versions = (text.match(/version:\s*'/g) || []).length;
      if (targetLine || versions > bestVersions) {
        best = text;
        bestVersions = versions;
        bestLine = lineNo;
        console.log(`line ${lineNo}: ${versions} versions, ${text.length} chars`);
      }
      if (targetLine) break;
    } catch {
      // skip malformed lines
    }
  }

  if (!best) {
    console.error('No recoverable changelog found');
    process.exit(1);
  }

  const upgraded = upgradeTypesAndItems(best);
  fs.writeFileSync(OUT, upgraded, 'utf8');
  console.log(`Wrote ${OUT} from line ${bestLine} (${bestVersions} versions)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});