/**
 * Sync priority fields from P{n} — text prefixes in changelog.ts
 */
import fs from 'fs';

const FILE = process.argv[2] || 'src/data/changelog.ts';
const src = fs.readFileSync(FILE, 'utf8');

const fixed = src.replace(
  /\{\s*priority:\s*'(P\d)',\s*text:\s*'(P(\d)[^']*)'\s*\}/g,
  (_m, _stored, text, n) => `{ priority: 'P${n}', text: '${text}' }`,
);

fs.writeFileSync(FILE, fixed, 'utf8');
console.log(`Synced priorities in ${FILE}`);