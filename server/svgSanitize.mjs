/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const DISALLOWED_PATTERNS = [
  /<script[\s\S]*?<\/script>/gi,
  /<foreignObject[\s\S]*?<\/foreignObject>/gi,
  /<iframe[\s\S]*?<\/iframe>/gi,
  /<embed[\s\S]*?\/?>/gi,
  /<object[\s\S]*?<\/object>/gi,
  /<style[\s\S]*?<\/style>/gi,
  /<link[\s\S]*?\/?>/gi,
  /<meta[\s\S]*?\/?>/gi,
  /<base[\s\S]*?\/?>/gi,
  /<use[\s\S]*?\/?>/gi,
  /<image[\s\S]*?\/?>/gi,
  /<feImage[\s\S]*?\/?>/gi,
  /<animate[\s\S]*?\/?>/gi,
  /<set[\s\S]*?\/?>/gi,
];

/** Strip active content from uploaded SVG emotes. */
export function sanitizeSvgBuffer(buffer) {
  let text = buffer.toString('utf8');
  if (!/<svg[\s>]/i.test(text)) throw new Error('Invalid SVG');

  for (const re of DISALLOWED_PATTERNS) {
    text = text.replace(re, '');
  }
  text = text.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  text = text.replace(/\s(?:xlink:)?href\s*=\s*("|')[^"']*\1/gi, '');
  text = text.replace(/\s(?:xlink:)?href\s*=\s*[^\s>]+/gi, '');
  text = text.replace(/javascript:/gi, '');
  text = text.replace(/vbscript:/gi, '');
  text = text.replace(/data:\s*[^;,\s]+/gi, 'data:blocked');
  text = text.replace(/@import/gi, '');
  text = text.replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, '');

  if (/<script|foreignObject|javascript:|vbscript:|<iframe|<embed|<object|<style|<use\b/i.test(text)) {
    throw new Error('SVG contains disallowed content');
  }
  return Buffer.from(text, 'utf8');
}