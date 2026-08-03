/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const PLACEHOLDER = '/favicon.svg';

export function decodeMemeName(name: string) {
  return name
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

/** Proxy imgflip CDN through Vite dev server; reject all other URLs. */
export function memeMediaUrl(url: string) {
  const raw = String(url ?? '').trim();
  if (!raw) return PLACEHOLDER;
  if (raw.startsWith('blob:')) return raw;
  if (raw.startsWith('/imgflip-cdn/')) return raw;
  if (raw.startsWith('https://i.imgflip.com/')) {
    return raw.replace('https://i.imgflip.com', '/imgflip-cdn');
  }
  if (raw.startsWith('//i.imgflip.com/')) {
    return raw.replace('//i.imgflip.com', '/imgflip-cdn');
  }
  return PLACEHOLDER;
}