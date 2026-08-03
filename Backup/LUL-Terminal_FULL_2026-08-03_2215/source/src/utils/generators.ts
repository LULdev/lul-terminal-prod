/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  PERSONA_AVATAR_STYLES,
  PERSONA_BIO_TEMPLATES,
  PERSONA_COMPANIES,
  PERSONA_COUNTRY_PHONE,
  PERSONA_EMAIL_DOMAINS,
  PERSONA_FIRST_NAMES,
  PERSONA_JOBS,
  PERSONA_LAST_NAMES,
} from '../data/personaData';
const ADJECTIVES = ['Quantum', 'Neon', 'Silent', 'Turbo', 'Cosmic', 'Pixel', 'Shadow', 'Hyper', 'Glitch', 'Velvet'];
const NOUNS = ['Badger', 'Relay', 'Forge', 'Nexus', 'Pulse', 'Orbit', 'Socket', 'Beacon', 'Kernel', 'Mirage'];

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateFakeName() {
  const first = pick(PERSONA_FIRST_NAMES);
  const last = pick(PERSONA_LAST_NAMES);
  return { first, last, full: `${first} ${last}` };
}

export function generateUsername(first: string, last: string) {
  const base = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '');
  return `${base}${randomInt(10, 999)}`;
}

export function generateHandle(first: string, last: string) {
  const styles = [
    () => `${first.toLowerCase()}${last.toLowerCase()}${randomInt(1, 99)}`,
    () => `${first[0]?.toLowerCase() ?? 'x'}_${last.toLowerCase()}`,
    () => `${last.toLowerCase()}.dev`,
    () => `the_${first.toLowerCase()}_`,
  ];
  return `@${pick(styles)()}`;
}

export function generatePhone(country: string) {
  const cc = PERSONA_COUNTRY_PHONE[country] ?? '+1';
  const block = () => randomInt(100, 999);
  return `${cc} ${block()} ${block()} ${randomInt(1000, 9999)}`;
}

export function generateEmail(first: string, last: string) {
  const local = pick([
    `${first.toLowerCase()}.${last.toLowerCase()}`,
    `${first[0]?.toLowerCase() ?? 'x'}${last.toLowerCase()}`,
    `${first.toLowerCase()}${randomInt(1988, 2004)}`,
    `${last.toLowerCase()}.${first.toLowerCase()}`,
  ]);
  return `${local}@${pick(PERSONA_EMAIL_DOMAINS)}`;
}

function fillBio(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

export function generatePassword(length = 16) {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
  return Array.from({ length }, () => pick(chars.split(''))).join('');
}

function slugHandle(first: string, last: string) {
  return `${first}${last}`.toLowerCase().replace(/[^a-z]/g, '');
}

export function generateAvatar(seed: string, style?: (typeof PERSONA_AVATAR_STYLES)[number]) {
  const avatarStyle = style ?? pick([...PERSONA_AVATAR_STYLES]);
  const params = new URLSearchParams({ seed, backgroundColor: '1e1b4b,312e81,1e293b' });
  return `https://api.dicebear.com/7.x/${avatarStyle}/svg?${params}`;
}

export type PersonaAddressRecord = {
  id: string;
  country: string;
  city: string;
  street: string;
  zip: string;
  address: string;
  timezone: string;
  venue?: string;
};

export type SocialHandles = {
  twitter: string;
  github: string;
  linkedin: string;
  instagram: string;
  discord: string;
};

export function generateSocialHandles(first: string, last: string): SocialHandles {
  const base = slugHandle(first, last);
  const short = `${first[0]?.toLowerCase() ?? 'x'}${last.toLowerCase().replace(/[^a-z]/g, '')}`;
  const variants = [
    base,
    `${base}${randomInt(1, 99)}`,
    `${short}_dev`,
    `${last.toLowerCase().replace(/[^a-z]/g, '')}.${first.toLowerCase()}`,
  ];
  const pickVariant = () => pick(variants);
  return {
    twitter: `@${pickVariant()}`,
    github: pickVariant(),
    linkedin: `linkedin.com/in/${pickVariant()}`,
    instagram: `@${pickVariant()}`,
    discord: `${first}#${randomInt(1000, 9999)}`,
  };
}

export type Persona = {
  name: string;
  username: string;
  handle: string;
  email: string;
  phone: string;
  job: string;
  company: string;
  city: string;
  country: string;
  address: string;
  street: string;
  zip: string;
  timezone: string;
  venue: string;
  age: number;
  avatar: string;
  social: SocialHandles;
  bio: string;
  password: string;
  addressId: string;
};

export function buildPersona(record: PersonaAddressRecord): Persona {
  const { first, last, full } = generateFakeName();
  const job = pick(PERSONA_JOBS);
  const company = pick(PERSONA_COMPANIES);
  const venue = record.venue ?? record.street;
  const bio = fillBio(pick(PERSONA_BIO_TEMPLATES), {
    city: record.city,
    country: record.country,
    job,
    company,
    venue,
    timezone: record.timezone,
  });
  return {
    name: full,
    username: generateUsername(first, last),
    handle: generateHandle(first, last),
    email: generateEmail(first, last),
    phone: generatePhone(record.country),
    job,
    company,
    city: record.city,
    country: record.country,
    street: record.street,
    zip: record.zip,
    address: record.address,
    timezone: record.timezone,
    venue,
    age: randomInt(19, 58),
    avatar: generateAvatar(full),
    social: generateSocialHandles(first, last),
    bio,
    password: generatePassword(),
    addressId: record.id,
  };
}

export function generateStartupName() {
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}

export function removeDuplicateLines(text: string) {
  const seen = new Set<string>();
  return text
    .split('\n')
    .filter((line) => {
      const key = line.trim();
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join('\n');
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..', '0': '-----', '1': '.----', '2': '..---',
  '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
};

export function toMorse(text: string) {
  return text
    .toUpperCase()
    .split('')
    .map((c) => (c === ' ' ? '/' : MORSE[c] ?? '#'))
    .join(' ');
}

export function rot13(text: string) {
  return text.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

export function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return { r, g, b };
}

export function luminance(r: number, g: number, b: number) {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function contrastRatio(hex1: string, hex2: string) {
  const a = hexToRgb(hex1);
  const b = hexToRgb(hex2);
  if (!a || !b) return null;
  const l1 = luminance(a.r, a.g, a.b);
  const l2 = luminance(b.r, b.g, b.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return ((lighter + 0.05) / (darker + 0.05)).toFixed(2);
}

export function generatePalette(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return Array.from({ length: 5 }, (_, i) => {
    const hue = Math.abs((hash + i * 57) % 360);
    return `hsl(${hue} 65% 55%)`;
  });
}

const JOKES = [
  'Why do programmers prefer dark mode? Because light attracts bugs.',
  'I told my RAM a joke. It forgot the punchline immediately.',
  'Git commit message: "fixed stuff" — the saga continues.',
  'There are only 10 types of people: those who understand binary and those who don\'t.',
  'A SQL query walks into a bar, walks up to two tables and asks: "Can I join you?"',
];

const FORTUNES = [
  'Your next deploy will succeed on the first try. Suspicious.',
  'A mysterious PR will appear with perfect tests.',
  'Avoid the trap button before noon.',
  'The cloud is just someone else\'s computer — and they are watching.',
  'Cache invalidation will be easy today. (Lie.)',
];

export function randomJoke() {
  return pick(JOKES);
}

export function randomFortune() {
  return pick(FORTUNES);
}