/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getEmoteMap } from './chatEmotesStore.mjs';

const EMOTE_TOKEN = /:([A-Za-z][A-Za-z0-9_]*):/g;

export async function buildEmoteSegments(text) {
  const raw = String(text ?? '');
  if (!raw.includes(':')) return null;

  const map = await getEmoteMap();
  if (!map.size) return null;

  const segments = [];
  let lastIndex = 0;
  let matched = false;

  for (const match of raw.matchAll(EMOTE_TOKEN)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      segments.push({ type: 'text', text: raw.slice(lastIndex, idx) });
    }
    const code = match[1];
    const emote = map.get(code.toLowerCase());
    if (emote) {
      matched = true;
      segments.push({
        type: 'emote',
        code: emote.code,
        label: emote.label,
        url: emote.url,
      });
    } else {
      segments.push({ type: 'text', text: match[0] });
    }
    lastIndex = idx + match[0].length;
  }

  if (!matched) return null;
  if (lastIndex < raw.length) segments.push({ type: 'text', text: raw.slice(lastIndex) });
  return segments.length ? segments : null;
}