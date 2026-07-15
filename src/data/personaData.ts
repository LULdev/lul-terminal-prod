/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const PERSONA_FIRST_NAMES = [
  'Alex', 'Jordan', 'Morgan', 'Riley', 'Casey', 'Quinn', 'Avery', 'Skyler', 'Nova', 'Kai',
  'Lena', 'Finn', 'Zara', 'Theo', 'Mila', 'Elena', 'Marco', 'Yuki', 'Sofia', 'Omar',
  'Ingrid', 'Diego', 'Amara', 'Henrik', 'Priya', 'Luca', 'Freya', 'Tariq', 'Nadia', 'Viktor',
  'Chloe', 'Raj', 'Isla', 'Mateo', 'Aisha', 'Leo', 'Hana', 'Bruno', 'Zoe', 'Kenji',
];

export const PERSONA_LAST_NAMES = [
  'Voss', 'Kramer', 'Nguyen', 'Silva', 'Petrov', 'Chen', 'Okonkwo', 'Bergström', 'Martinez', 'Kim',
  'Dubois', 'Sato', 'Hansen', 'Ali', 'Rossi', 'Patel', 'Müller', 'Garcia', 'Johansson', 'Ibrahim',
  'Kowalski', 'Nakamura', 'Okafor', 'Schmidt', 'Fernandez', 'Andersen', 'Popov', 'Costa', 'Walsh', 'Tanaka',
  'Moreau', 'Khan', 'Lindqvist', 'Romano', 'Yilmaz', 'Novak', 'Santos', 'Reed', 'Bauer', 'Park',
];

export const PERSONA_JOBS = [
  'DevOps Engineer', 'UX Researcher', 'Threat Analyst', 'Cloud Architect', 'Data Wrangler', 'SRE',
  'Security Engineer', 'Frontend Developer', 'ML Ops Lead', 'Technical Writer', 'QA Automation Lead',
  'Platform Engineer', 'Penetration Tester', 'Solutions Architect', 'Community Manager', 'Release Captain',
  'Network Architect', 'Database Administrator', 'Product Manager', 'Compliance Officer',
];

export const PERSONA_COMPANIES = [
  'Nebula Systems', 'VoidStack GmbH', 'Pixel Forge Labs', 'Quantum Relay AG', 'Shadow Socket Inc.',
  'Hyper Orbit Ltd.', 'Glitch Beacon Co.', 'Turbo Kernel Works', 'Cosmic Nexus BV', 'Velvet Pulse Studio',
  'Mirage Cloud', 'Silent Relay Group', 'Neon Forge International', 'Terminal Ghost LLC', 'Packet Saints',
];

export const PERSONA_EMAIL_DOMAINS = [
  'mailflux.io', 'voidbox.net', 'lul-terminal.dev', 'phantommail.app', 'netghost.email',
  'fakeinbox.dev', 'demouser.io', 'staging-mail.net', 'aliasforge.app', 'testpersona.co',
];

export const PERSONA_BIO_TEMPLATES = [
  'Based in {city}, {country}. Uses real-world addresses for demo data only.',
  'Remote from {city} — timezone {timezone}.',
  '{job} at {company}. Demo persona tied to verified public address.',
  'Works as {job}. Located near {venue} in {city}.',
  'Stationed in {city}, {country}. All data except address is fictional.',
  'Professional {job}. Address reference: {venue}.',
];

export const PERSONA_AVATAR_STYLES = [
  'avataaars', 'lorelei', 'micah', 'notionists', 'pixel-art', 'bottts', 'identicon', 'shapes', 'thumbs', 'adventurer',
] as const;

export const PERSONA_COUNTRY_PHONE: Record<string, string> = {
  Germany: '+49',
  USA: '+1',
  'United Kingdom': '+44',
  France: '+33',
  Netherlands: '+31',
  Switzerland: '+41',
  Austria: '+43',
  Spain: '+34',
  Italy: '+39',
  Canada: '+1',
};

export const PERSONA_STATS = {
  firstNames: PERSONA_FIRST_NAMES.length,
  lastNames: PERSONA_LAST_NAMES.length,
  jobs: PERSONA_JOBS.length,
  companies: PERSONA_COMPANIES.length,
  bios: PERSONA_BIO_TEMPLATES.length,
  avatarStyles: PERSONA_AVATAR_STYLES.length,
  socialPlatforms: 5,
  combinations: PERSONA_FIRST_NAMES.length * PERSONA_LAST_NAMES.length,
  dbAddresses: 250,
  dbCountries: 10,
};