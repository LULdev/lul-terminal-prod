/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const HTTP_STATUS: Record<string, string> = {
  '100': 'Continue', '101': 'Switching Protocols', '102': 'Processing', '103': 'Early Hints',
  '200': 'OK', '201': 'Created', '202': 'Accepted', '204': 'No Content', '206': 'Partial Content',
  '301': 'Moved Permanently', '302': 'Found', '304': 'Not Modified', '307': 'Temporary Redirect', '308': 'Permanent Redirect',
  '400': 'Bad Request', '401': 'Unauthorized', '403': 'Forbidden', '404': 'Not Found', '405': 'Method Not Allowed',
  '408': 'Request Timeout', '409': 'Conflict', '410': 'Gone', '418': "I'm a teapot", '422': 'Unprocessable Entity',
  '429': 'Too Many Requests', '451': 'Unavailable For Legal Reasons',
  '500': 'Internal Server Error', '501': 'Not Implemented', '502': 'Bad Gateway', '503': 'Service Unavailable',
  '504': 'Gateway Timeout', '505': 'HTTP Version Not Supported',
};

export const COUNTRIES: Record<string, string> = {
  DE: 'Germany', AT: 'Austria', CH: 'Switzerland', FR: 'France', NL: 'Netherlands', BE: 'Belgium',
  IT: 'Italy', ES: 'Spain', PT: 'Portugal', PL: 'Poland', CZ: 'Czechia', SE: 'Sweden', NO: 'Norway',
  DK: 'Denmark', FI: 'Finland', IE: 'Ireland', GB: 'United Kingdom', US: 'United States', CA: 'Canada',
  AU: 'Australia', NZ: 'New Zealand', JP: 'Japan', KR: 'South Korea', CN: 'China', IN: 'India',
  BR: 'Brazil', MX: 'Mexico', AR: 'Argentina', RU: 'Russia', UA: 'Ukraine', TR: 'Turkey', EG: 'Egypt',
  ZA: 'South Africa', NG: 'Nigeria', AE: 'UAE', SA: 'Saudi Arabia', IL: 'Israel', SG: 'Singapore',
  TH: 'Thailand', VN: 'Vietnam', ID: 'Indonesia', PH: 'Philippines', MY: 'Malaysia', HK: 'Hong Kong',
  TW: 'Taiwan', GR: 'Greece', RO: 'Romania', HU: 'Hungary', SK: 'Slovakia', HR: 'Croatia', RS: 'Serbia',
};

export const CURRENCIES: Record<string, string> = {
  EUR: 'Euro', USD: 'US Dollar', GBP: 'British Pound', CHF: 'Swiss Franc', JPY: 'Japanese Yen',
  CNY: 'Chinese Yuan', INR: 'Indian Rupee', AUD: 'Australian Dollar', CAD: 'Canadian Dollar',
  BRL: 'Brazilian Real', MXN: 'Mexican Peso', KRW: 'South Korean Won', SEK: 'Swedish Krona',
  NOK: 'Norwegian Krone', DKK: 'Danish Krone', PLN: 'Polish Zloty', CZK: 'Czech Koruna',
  HUF: 'Hungarian Forint', TRY: 'Turkish Lira', ZAR: 'South African Rand', AED: 'UAE Dirham',
  SGD: 'Singapore Dollar', HKD: 'Hong Kong Dollar', NZD: 'New Zealand Dollar', RUB: 'Russian Ruble',
  UAH: 'Ukrainian Hryvnia', THB: 'Thai Baht', IDR: 'Indonesian Rupiah', PHP: 'Philippine Peso',
};

export const MIME_EXT: Record<string, string> = {
  json: 'application/json', xml: 'application/xml', html: 'text/html', htm: 'text/html', css: 'text/css',
  js: 'text/javascript', mjs: 'text/javascript', ts: 'text/typescript', jsx: 'text/jsx', tsx: 'text/tsx',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  ico: 'image/x-icon', pdf: 'application/pdf', zip: 'application/zip', gz: 'application/gzip', tar: 'application/x-tar',
  mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
  wasm: 'application/wasm', csv: 'text/csv', txt: 'text/plain', md: 'text/markdown', yaml: 'text/yaml', yml: 'text/yaml',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', exe: 'application/octet-stream',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export const GIT_COMMANDS: Record<string, string> = {
  'git status': 'Show working tree status',
  'git add .': 'Stage all changes',
  'git commit -m': 'Commit staged changes with message',
  'git push': 'Push commits to remote',
  'git pull': 'Fetch and merge remote changes',
  'git branch': 'List or create branches',
  'git checkout': 'Switch branches or restore files',
  'git merge': 'Merge branches',
  'git rebase': 'Reapply commits on top of base',
  'git stash': 'Temporarily shelve changes',
  'git log --oneline': 'Compact commit history',
  'git diff': 'Show unstaged changes',
  'git reset --hard': 'Discard local changes (dangerous)',
  'git clone': 'Clone a repository',
  'git fetch': 'Download remote refs',
  'git remote -v': 'List remotes',
  'git tag': 'Create or list tags',
  'git cherry-pick': 'Apply specific commit',
  'git revert': 'Create revert commit',
  'git bisect': 'Binary search for bad commit',
};

export const DOCKER_COMMANDS: Record<string, string> = {
  'docker ps': 'List running containers',
  'docker images': 'List images',
  'docker build -t': 'Build image from Dockerfile',
  'docker run': 'Run container from image',
  'docker stop': 'Stop running container',
  'docker rm': 'Remove container',
  'docker rmi': 'Remove image',
  'docker logs': 'Fetch container logs',
  'docker exec -it': 'Interactive shell in container',
  'docker compose up': 'Start compose stack',
  'docker compose down': 'Stop compose stack',
  'docker pull': 'Pull image from registry',
  'docker push': 'Push image to registry',
  'docker network ls': 'List networks',
  'docker volume ls': 'List volumes',
};

export const LINUX_COMMANDS: Record<string, string> = {
  ls: 'List directory contents', cd: 'Change directory', pwd: 'Print working directory',
  cp: 'Copy files', mv: 'Move/rename files', rm: 'Remove files', mkdir: 'Create directory',
  cat: 'Concatenate and print files', grep: 'Search text patterns', find: 'Find files',
  chmod: 'Change permissions', chown: 'Change ownership', ps: 'Process status',
  top: 'Dynamic process viewer', kill: 'Send signal to process', curl: 'Transfer URL data',
  wget: 'Download files', tar: 'Archive utility', ssh: 'Secure shell remote login',
  scp: 'Secure copy over SSH', ping: 'Test network reachability', netstat: 'Network statistics',
  df: 'Disk space usage', du: 'Directory disk usage', tail: 'Output last lines of file',
  head: 'Output first lines of file', sed: 'Stream editor', awk: 'Pattern scanning language',
};

export const SQL_KEYWORDS: Record<string, string> = {
  SELECT: 'Retrieve rows from table', FROM: 'Specify table source', WHERE: 'Filter rows',
  JOIN: 'Combine tables', LEFT: 'Left outer join', INNER: 'Inner join', GROUP: 'Group rows',
  BY: 'Group/order clause', HAVING: 'Filter groups', ORDER: 'Sort results', LIMIT: 'Cap row count',
  INSERT: 'Add new rows', INTO: 'Target table for insert', VALUES: 'Literal row values',
  UPDATE: 'Modify existing rows', SET: 'Assign column values', DELETE: 'Remove rows',
  CREATE: 'Create schema object', TABLE: 'Relational table', INDEX: 'Speed up lookups',
  PRIMARY: 'Primary key constraint', KEY: 'Key constraint', FOREIGN: 'Foreign key reference',
  NULL: 'Missing value', NOT: 'Negation', AND: 'Logical and', OR: 'Logical or', AS: 'Alias',
  DISTINCT: 'Unique rows only', COUNT: 'Aggregate count', SUM: 'Aggregate sum', AVG: 'Average',
};

export const EMOJI_MAP: Record<string, string> = {
  fire: '🔥', rocket: '🚀', bug: '🐛', coffee: '☕', heart: '❤️', star: '⭐', check: '✅',
  cross: '❌', warn: '⚠️', lock: '🔒', key: '🔑', mail: '📧', phone: '📱', computer: '💻',
  globe: '🌐', cloud: '☁️', sun: '☀️', moon: '🌙', cat: '🐱', dog: '🐶', party: '🎉',
  dice: '🎲', music: '🎵', book: '📚', money: '💰', chart: '📈', tool: '🛠️', brain: '🧠',
  ghost: '👻', alien: '👽', robot: '🤖', skull: '💀', eyes: '👀', think: '🤔', cool: '😎',
};

export const REGEX_PRESETS: Record<string, string> = {
  email: '^[\\w.+-]+@[\\w-]+\\.[\\w.-]+$',
  url: '^https?:\\/\\/[\\w.-]+(?:\\.[\\w.-]+)+[\\w.,@?^=%&:/~+#-]*$',
  ipv4: '^(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)$',
  hexcolor: '^#(?:[0-9a-fA-F]{3}){1,2}$',
  slug: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
  uuid: '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  phone_de: '^(\\+49|0)[1-9]\\d{1,14}$',
  date_iso: '^\\d{4}-\\d{2}-\\d{2}$',
  username: '^[a-zA-Z][a-zA-Z0-9_]{2,15}$',
  creditcard: '^\\d{13,19}$',
};

export const UNIT_PAIRS: { id: string; name: string; icon: string; convert: (v: number) => string }[] = [
  { id: 'km-mi', name: 'km → miles', icon: '🛣️', convert: (v) => `${v} km = ${(v * 0.621371).toFixed(6)} mi` },
  { id: 'mi-km', name: 'miles → km', icon: '🛣️', convert: (v) => `${v} mi = ${(v * 1.60934).toFixed(6)} km` },
  { id: 'm-ft', name: 'meters → feet', icon: '📏', convert: (v) => `${v} m = ${(v * 3.28084).toFixed(4)} ft` },
  { id: 'ft-m', name: 'feet → meters', icon: '📏', convert: (v) => `${v} ft = ${(v / 3.28084).toFixed(4)} m` },
  { id: 'cm-in', name: 'cm → inches', icon: '📐', convert: (v) => `${v} cm = ${(v / 2.54).toFixed(4)} in` },
  { id: 'in-cm', name: 'inches → cm', icon: '📐', convert: (v) => `${v} in = ${(v * 2.54).toFixed(4)} cm` },
  { id: 'kg-lb', name: 'kg → pounds', icon: '⚖️', convert: (v) => `${v} kg = ${(v * 2.20462).toFixed(4)} lb` },
  { id: 'lb-kg', name: 'pounds → kg', icon: '⚖️', convert: (v) => `${v} lb = ${(v / 2.20462).toFixed(4)} kg` },
  { id: 'g-oz', name: 'grams → oz', icon: '⚖️', convert: (v) => `${v} g = ${(v / 28.3495).toFixed(4)} oz` },
  { id: 'oz-g', name: 'oz → grams', icon: '⚖️', convert: (v) => `${v} oz = ${(v * 28.3495).toFixed(4)} g` },
  { id: 'l-gal', name: 'liters → gallons', icon: '🥤', convert: (v) => `${v} L = ${(v * 0.264172).toFixed(4)} gal` },
  { id: 'gal-l', name: 'gallons → liters', icon: '🥤', convert: (v) => `${v} gal = ${(v / 0.264172).toFixed(4)} L` },
  { id: 'c-f', name: '°C → °F', icon: '🌡️', convert: (v) => `${v}°C = ${(v * 9 / 5 + 32).toFixed(2)}°F` },
  { id: 'f-c', name: '°F → °C', icon: '🌡️', convert: (v) => `${v}°F = ${((v - 32) * 5 / 9).toFixed(2)}°C` },
  { id: 'c-k', name: '°C → K', icon: '🌡️', convert: (v) => `${v}°C = ${(v + 273.15).toFixed(2)} K` },
  { id: 'k-c', name: 'K → °C', icon: '🌡️', convert: (v) => `${v} K = ${(v - 273.15).toFixed(2)}°C` },
  { id: 'mb-gb', name: 'MB → GB', icon: '💾', convert: (v) => `${v} MB = ${(v / 1024).toFixed(6)} GB` },
  { id: 'gb-mb', name: 'GB → MB', icon: '💾', convert: (v) => `${v} GB = ${(v * 1024).toFixed(2)} MB` },
  { id: 'kb-mb', name: 'KB → MB', icon: '💾', convert: (v) => `${v} KB = ${(v / 1024).toFixed(6)} MB` },
  { id: 'mb-kb', name: 'MB → KB', icon: '💾', convert: (v) => `${v} MB = ${(v * 1024).toFixed(2)} KB` },
  { id: 'deg-rad', name: 'degrees → radians', icon: '📐', convert: (v) => `${v}° = ${(v * Math.PI / 180).toFixed(6)} rad` },
  { id: 'rad-deg', name: 'radians → degrees', icon: '📐', convert: (v) => `${v} rad = ${(v * 180 / Math.PI).toFixed(4)}°` },
  { id: 'kmh-mph', name: 'km/h → mph', icon: '🏎️', convert: (v) => `${v} km/h = ${(v * 0.621371).toFixed(4)} mph` },
  { id: 'mph-kmh', name: 'mph → km/h', icon: '🏎️', convert: (v) => `${v} mph = ${(v * 1.60934).toFixed(4)} km/h` },
  { id: 'hp-kw', name: 'hp → kW', icon: '⚡', convert: (v) => `${v} hp = ${(v * 0.7457).toFixed(4)} kW` },
  { id: 'kw-hp', name: 'kW → hp', icon: '⚡', convert: (v) => `${v} kW = ${(v / 0.7457).toFixed(4)} hp` },
];