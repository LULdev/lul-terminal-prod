/**
 * Replay changelog.ts edits from session transcript to rebuild full history.
 */
import fs from 'fs';
import readline from 'readline';

const TRANSCRIPT =
  'C:/Users/LUL/.grok/sessions/C%3A%5CUsers%5CLUL/019f2223-1afb-72e2-89c5-1bd1249deb08/updates.jsonl';
const OUT = 'C:/Users/LUL/Downloads/lul-terminal (1)/src/data/changelog.replayed.ts';

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

const CHANGELOG_PATH = 'C:\\Users\\LUL\\Downloads\\lul-terminal (1)\\src\\data\\changelog.ts';

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

  body = body.replace(
    /\{\s*priority:\s*'(P\d)',\s*text:\s*'(P\d[^']*)'\s*\}/g,
    (_m, p, text) => `{ priority: '${p}', text: '${text}' }`,
  );

  return header + body + '\n';
}

async function main() {
  const rl = readline.createInterface({
    input: fs.createReadStream(TRANSCRIPT, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let content = null;
  let writes = 0;
  let replaces = 0;
  let skipped = 0;

  for await (const line of rl) {
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }

    const update = obj?.params?.update;
    if (!update) continue;

    // Full Write
    if (update.sessionUpdate === 'tool_call' && update.toolCallId) {
      const raw = update.rawInput;
      if (raw?.path === CHANGELOG_PATH && raw?.contents) {
        if (!raw.contents.includes('[object Object]') && !raw.contents.includes('tool_call_id')) {
          content = raw.contents;
          writes++;
        }
        continue;
      }
    }

    // Completed StrReplace from diff content
    if (update.sessionUpdate === 'tool_call_update' && update.status === 'completed') {
      const blocks = update.content;
      if (!Array.isArray(blocks)) continue;
      for (const block of blocks) {
        if (block?.type !== 'diff') continue;
        if (block.path !== CHANGELOG_PATH.replace(/\\/g, '/').replace('C:/Users/LUL/', 'C:\\Users\\LUL\\')) continue;
        if (!block.path?.includes('changelog.ts')) continue;
        if (block.oldText == null && block.newText) {
          content = block.newText;
          writes++;
          continue;
        }
        if (content == null) {
          skipped++;
          continue;
        }
        if (block.oldText && block.newText && content.includes(block.oldText)) {
          content = content.replace(block.oldText, block.newText);
          replaces++;
        } else if (block.oldText && block.newText) {
          skipped++;
        }
      }
    }

    // Also handle StrReplace rawInput on tool_call (apply immediately if we have content)
    if (update.sessionUpdate === 'tool_call') {
      const raw = update.rawInput;
      if (raw?.path === CHANGELOG_PATH && raw?.old_string && raw?.new_string && content) {
        if (content.includes(raw.old_string)) {
          content = content.replace(raw.old_string, raw.new_string);
          replaces++;
        }
      }
    }
  }

  if (!content) {
    console.error('Failed to rebuild changelog');
    process.exit(1);
  }

  const versions = (content.match(/version:\s*'/g) || []).length;
  console.log(`Rebuilt: ${writes} writes, ${replaces} replaces, ${skipped} skipped, ${versions} versions, ${content.length} chars`);

  if (!content.trimEnd().endsWith('];')) {
    console.warn('Warning: content may be incomplete (does not end with ];)');
  }

  const upgraded = upgradeTypesAndItems(content);
  fs.writeFileSync(OUT, upgraded, 'utf8');
  console.log(`Wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});