/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { pick, randomInt } from './generators';

export function parseCsvToJson(csv: string) {
  const lines = csv.trim().split('\n').filter(Boolean);
  if (!lines.length) return '[]';
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim());
    return headers.reduce<Record<string, string>>((acc, h, i) => {
      acc[h] = vals[i] ?? '';
      return acc;
    }, {});
  });
  return JSON.stringify(rows, null, 2);
}

export function isPrime(n: number) {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i <= Math.sqrt(n); i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

export function luhnCheck(num: string) {
  const digits = num.replace(/\D/g, '').split('').map(Number);
  if (digits.length < 13) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i];
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function decodeJwt(token: string) {
  const parts = token.trim().split('.');
  if (parts.length < 2) throw new Error('Invalid JWT format');
  const decode = (s: string) => JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/')));
  return { header: decode(parts[0]), payload: decode(parts[1]) };
}

export function passwordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  const labels = ['Very weak', 'Weak', 'Medium', 'Strong', 'Very strong', 'Paranoid'];
  return { score, label: labels[score] ?? labels[0], percent: Math.min(100, score * 20) };
}

export function caesar(text: string, shift: number) {
  return text.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + shift + 26) % 26) + base);
  });
}

export function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function generateFakeIban() {
  const country = pick(['DE', 'AT', 'CH', 'NL', 'FR']);
  const digits = Array.from({ length: 18 }, () => randomInt(0, 9)).join('');
  return `${country}${digits}`;
}

const NATO: Record<string, string> = {
  a: 'Alpha', b: 'Bravo', c: 'Charlie', d: 'Delta', e: 'Echo', f: 'Foxtrot', g: 'Golf', h: 'Hotel',
  i: 'India', j: 'Juliet', k: 'Kilo', l: 'Lima', m: 'Mike', n: 'November', o: 'Oscar', p: 'Papa',
  q: 'Quebec', r: 'Romeo', s: 'Sierra', t: 'Tango', u: 'Uniform', v: 'Victor', w: 'Whiskey',
  x: 'X-ray', y: 'Yankee', z: 'Zulu',
};

export function toNato(text: string) {
  return text
    .toLowerCase()
    .split('')
    .map((c) => (NATO[c] ? `${c.toUpperCase()} = ${NATO[c]}` : c === ' ' ? '⎵ SPACE' : `# ${c}`))
    .join('\n');
}

const HTTP_CODES: Record<string, string> = {
  '200': 'OK', '201': 'Created', '204': 'No Content', '301': 'Moved Permanently', '302': 'Found',
  '304': 'Not Modified', '400': 'Bad Request', '401': 'Unauthorized', '403': 'Forbidden',
  '404': 'Not Found', '408': 'Request Timeout', '418': "I'm a teapot", '429': 'Too Many Requests',
  '500': 'Internal Server Error', '502': 'Bad Gateway', '503': 'Service Unavailable', '504': 'Gateway Timeout',
};

export function httpStatus(code: string) {
  return HTTP_CODES[code.trim()] ?? 'Unknown status code';
}

const MIME: Record<string, string> = {
  json: 'application/json', html: 'text/html', css: 'text/css', js: 'text/javascript',
  ts: 'text/typescript', png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml',
  pdf: 'application/pdf', zip: 'application/zip', mp4: 'video/mp4', mp3: 'audio/mpeg', wasm: 'application/wasm',
};

export function mimeLookup(ext: string) {
  return MIME[ext.toLowerCase().replace(/^\./, '')] ?? 'application/octet-stream';
}

export function cidrInfo(ip: string, prefix = 24) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => p < 0 || p > 255)) return null;
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  const ipNum = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  const network = ipNum & mask;
  const broadcast = network | (~mask >>> 0);
  const fmt = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  return { network: fmt(network), broadcast: fmt(broadcast), hosts: (broadcast - network - 1) || 0, prefix };
}

export async function sha1(text: string) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function uuidV4() {
  return crypto.randomUUID();
}

const HAIKU = [
  ['Code compiles at dawn', 'Coffee steam rises slowly', 'Deploy button glows'],
  ['Silent prod server', 'Logs whisper sweet nothing', 'Pager stays asleep'],
  ['Merge conflict cries', 'Git blames everyone here', 'We blame the intern'],
];

const EXCUSES = [
  'Works on my machine — classic.',
  'DNS propagation is still cosmic.',
  'The staging goblin ate my build.',
  'Waiting for quantum cache invalidation.',
  'It is a feature, not a regression.',
];

const COMPLIMENTS = [
  'Your git history reads like poetry.',
  'You debug faster than light travels.',
  'Your variable names spark joy.',
  'Production fears your competence.',
];

const EIGHT_BALL = [
  'Yes — deploy immediately.', 'No — rollback recommended.', 'Ask again after coffee.',
  'Signs point to cache invalidation.', 'Cannot predict — check Grafana.', 'Absolutely — ship it.',
];

const BUZZWORDS = ['Synergy', 'Leverage', 'Pivot', 'Disrupt', 'Scale', 'AI-first', 'Blockchain', 'Agile', 'Circle back'];

export function randomHaiku() {
  const lines = pick(HAIKU);
  return lines.join('\n');
}

export function randomExcuse() {
  return pick(EXCUSES);
}

export function randomCompliment() {
  return pick(COMPLIMENTS);
}

export function magic8Ball() {
  return pick(EIGHT_BALL);
}

export function buzzwordCard() {
  const shuffled = [...BUZZWORDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 9).map((w, i) => `${(i + 1).toString().padStart(2)}. ${w}`).join('\n');
}

export function teamName() {
  return `${pick(['Alpha', 'Neon', 'Quantum', 'Shadow', 'Turbo'])} ${pick(['Squad', 'Unit', 'Collective', 'Guild', 'Brigade'])}`;
}

export function bandName() {
  return `${pick(['Electric', 'Velvet', 'Static', 'Cosmic', 'Neon'])} ${pick(['Wolves', 'Paradox', 'Mirage', 'Relay', 'Voltage'])}`;
}

export function threatLevel() {
  const levels = ['LOW', 'ELEVATED', 'HIGH', 'CRITICAL', 'CLAW-IMMINENT'];
  return `${pick(levels)} — ${randomInt(1, 99)}% anomaly flux`;
}