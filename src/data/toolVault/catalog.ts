/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  COUNTRIES,
  CURRENCIES,
  DOCKER_COMMANDS,
  EMOJI_MAP,
  GIT_COMMANDS,
  HTTP_STATUS,
  LINUX_COMMANDS,
  MIME_EXT,
  REGEX_PRESETS,
  SQL_KEYWORDS,
  UNIT_PAIRS,
} from './referenceData';
import type { CategoryMeta, ToolDefinition } from './types';
import { slugify } from '../../utils/generators';

const BASE_TOOLS: ToolDefinition[] = [
  // Original 50
  { id: 'json-format', name: 'JSON Formatter', icon: '{ }', category: 'data', subcategory: 'JSON', tags: ['json','format'], description: 'Format & validate JSON', inputMode: 'textarea', defaultInput: '{"hello":"world"}' },
  { id: 'json-minify', name: 'JSON Minifier', icon: '📦', category: 'data', subcategory: 'JSON', tags: ['json','minify'], description: 'Minify JSON', inputMode: 'textarea' },
  { id: 'csv-json', name: 'CSV → JSON', icon: '📊', category: 'data', subcategory: 'CSV', tags: ['csv','json'], description: 'CSV to JSON array', inputMode: 'textarea', defaultInput: 'name,role\nLUL,admin' },
  { id: 'line-sorter', name: 'Line Sorter', icon: '↕️', category: 'text', subcategory: 'Lines', tags: ['sort'], description: 'Sort lines alphabetically', inputMode: 'textarea' },
  { id: 'line-sorter-desc', name: 'Line Sorter Desc', icon: '⬇️', category: 'text', subcategory: 'Lines', tags: ['sort'], description: 'Sort lines descending', inputMode: 'textarea' },
  { id: 'email-extract', name: 'Email Extractor', icon: '📧', category: 'text', subcategory: 'Extract', tags: ['email'], description: 'Extract emails', inputMode: 'textarea' },
  { id: 'url-extract', name: 'URL Extractor', icon: '🔗', category: 'text', subcategory: 'Extract', tags: ['url'], description: 'Extract URLs', inputMode: 'textarea' },
  { id: 'palindrome', name: 'Palindrome Check', icon: '↔️', category: 'text', subcategory: 'Analyze', tags: ['palindrome'], description: 'Check palindrome', inputMode: 'single', defaultInput: 'level' },
  { id: 'empty-lines', name: 'Empty Line Remover', icon: '🧹', category: 'text', subcategory: 'Lines', tags: ['clean'], description: 'Remove empty lines', inputMode: 'textarea' },
  { id: 'unit-length', name: 'Length km bundle', icon: '📏', category: 'math', subcategory: 'Units', tags: ['km'], description: 'km in mi/m/ft', inputMode: 'single', placeholder: 'km' },
  { id: 'temp-convert', name: 'Temperature C', icon: '🌡️', category: 'math', subcategory: 'Units', tags: ['celsius'], description: 'Celsius in F/K', inputMode: 'single' },
  { id: 'percentage', name: 'Percentage Calc', icon: '%', category: 'math', subcategory: 'Calc', tags: ['percent'], description: 'X% of Y', inputMode: 'dual', placeholder: '15', placeholder2: '200' },
  { id: 'random-range', name: 'Random Range', icon: '🎯', category: 'math', subcategory: 'Random', tags: ['random'], description: 'Random number min–max', inputMode: 'dual', placeholder: '1', placeholder2: '100' },
  { id: 'prime-check', name: 'Prime Checker', icon: '🔍', category: 'math', subcategory: 'Number', tags: ['prime'], description: 'Prime number test', inputMode: 'single' },
  { id: 'uuid-gen', name: 'UUID v4', icon: '🆔', category: 'security', subcategory: 'IDs', tags: ['uuid'], description: 'Generate UUID', inputMode: 'none' },
  { id: 'pwd-strength', name: 'Password Strength', icon: '💪', category: 'security', subcategory: 'Password', tags: ['password'], description: 'Password strength', inputMode: 'single' },
  { id: 'jwt-decode', name: 'JWT Decoder', icon: '🪪', category: 'security', subcategory: 'Token', tags: ['jwt'], description: 'Show JWT payload', inputMode: 'textarea' },
  { id: 'luhn-check', name: 'Luhn Validator', icon: '💳', category: 'security', subcategory: 'Card', tags: ['luhn'], description: 'Luhn validation', inputMode: 'single' },
  { id: 'sha1-hash', name: 'SHA-1 Hash', icon: '⚗️', category: 'security', subcategory: 'Hash', tags: ['sha1'], description: 'SHA-1 Hash', inputMode: 'single' },
  { id: 'sha256-hash', name: 'SHA-256 Hash', icon: '🔒', category: 'security', subcategory: 'Hash', tags: ['sha256'], description: 'SHA-256 Hash', inputMode: 'single' },
  { id: 'sha512-hash', name: 'SHA-512 Hash', icon: '🔐', category: 'security', subcategory: 'Hash', tags: ['sha512'], description: 'SHA-512 Hash', inputMode: 'single' },
  { id: 'bin-hex', name: 'Binary ↔ Hex', icon: '01', category: 'encoding', subcategory: 'Convert', tags: ['binary','hex'], description: 'Binary/hex converter', inputMode: 'single' },
  { id: 'caesar-cipher', name: 'Caesar Cipher', icon: '🏛️', category: 'encoding', subcategory: 'Cipher', tags: ['caesar'], description: 'Caesar cipher with shift', inputMode: 'single', placeholder: 'Text' },
  { id: 'css-gradient', name: 'CSS Gradient', icon: '🌈', category: 'design', subcategory: 'CSS', tags: ['gradient'], description: 'Linear-gradient CSS', inputMode: 'dual', placeholder: '#6366f1', placeholder2: '#22d3ee' },
  { id: 'aspect-ratio', name: 'Aspect Ratio', icon: '🖼️', category: 'design', subcategory: 'Layout', tags: ['ratio'], description: 'Aspect ratio', inputMode: 'dual', placeholder: '16', placeholder2: '9' },
  { id: 'screen-info', name: 'Screen Info', icon: '🖥️', category: 'design', subcategory: 'Display', tags: ['screen'], description: 'Viewport info', inputMode: 'none' },
  { id: 'box-shadow', name: 'Box Shadow CSS', icon: '📦', category: 'design', subcategory: 'CSS', tags: ['shadow'], description: 'box-shadow Generator', inputMode: 'dual' },
  { id: 'hex-brightness', name: 'HEX Brightness', icon: '💡', category: 'design', subcategory: 'Color', tags: ['hex'], description: 'Analyze brightness', inputMode: 'single', placeholder: '#6366f1' },
  { id: 'age-calc', name: 'Age Calculator', icon: '🎂', category: 'time', subcategory: 'Calc', tags: ['age'], description: 'Calculate age', inputMode: 'single', placeholder: '1990-05-20' },
  { id: 'iso-week', name: 'ISO Week', icon: '📅', category: 'time', subcategory: 'Calendar', tags: ['iso'], description: 'ISO calendar week', inputMode: 'single' },
  { id: 'add-days', name: 'Add Days', icon: '➕', category: 'time', subcategory: 'Calc', tags: ['date'], description: 'Add days', inputMode: 'dual', placeholder: '2026-07-02', placeholder2: '7' },
  { id: 'http-status', name: 'HTTP Status Lookup', icon: '🌐', category: 'web', subcategory: 'HTTP', tags: ['http'], description: 'Status code meaning', inputMode: 'single', placeholder: '404' },
  { id: 'mime-lookup', name: 'MIME Lookup', icon: '📄', category: 'web', subcategory: 'MIME', tags: ['mime'], description: 'Extension → MIME', inputMode: 'single', placeholder: 'json' },
  { id: 'cidr-calc', name: 'CIDR Calculator', icon: '🛰️', category: 'network', subcategory: 'IP', tags: ['cidr'], description: 'IPv4 network', inputMode: 'dual', placeholder: '192.168.1.0', placeholder2: '24' },
  { id: 'user-agent', name: 'User-Agent', icon: '🕵️', category: 'web', subcategory: 'Browser', tags: ['ua'], description: 'Show browser user agent', inputMode: 'none' },
  { id: 'mac-format', name: 'MAC Formatter', icon: '📡', category: 'network', subcategory: 'MAC', tags: ['mac'], description: 'Normalize MAC address', inputMode: 'single' },
  { id: 'html-entities', name: 'HTML Entities', icon: '&lt;', category: 'encoding', subcategory: 'HTML', tags: ['html'], description: 'HTML encode/decode', inputMode: 'single' },
  { id: 'fake-iban', name: 'Fake IBAN', icon: '🏦', category: 'generators', subcategory: 'Finance', tags: ['iban'], description: 'Test IBAN', inputMode: 'none' },
  { id: 'team-name', name: 'Team Name', icon: '👥', category: 'generators', subcategory: 'Names', tags: ['team'], description: 'Team name', inputMode: 'none' },
  { id: 'band-name', name: 'Band Name', icon: '🎸', category: 'generators', subcategory: 'Names', tags: ['band'], description: 'Band name', inputMode: 'none' },
  { id: 'haiku-gen', name: 'Haiku Generator', icon: '🌸', category: 'generators', subcategory: 'Creative', tags: ['haiku'], description: '5-7-5 Haiku', inputMode: 'none' },
  { id: 'nato-alpha', name: 'NATO Alphabet', icon: '📻', category: 'encoding', subcategory: 'Phonetic', tags: ['nato'], description: 'NATO spelling alphabet', inputMode: 'single', defaultInput: 'LUL' },
  { id: 'bulk-uuid', name: 'Bulk UUID ×10', icon: '📋', category: 'generators', subcategory: 'IDs', tags: ['uuid'], description: '10 UUIDs', inputMode: 'none' },
  { id: 'dev-excuse', name: 'Dev Excuse', icon: '🙈', category: 'fun', subcategory: 'Dev', tags: ['excuse'], description: 'Dev excuse', inputMode: 'none' },
  { id: 'magic-8ball', name: 'Magic 8-Ball', icon: '🎱', category: 'fun', subcategory: 'Oracle', tags: ['8ball'], description: 'Oracle answer', inputMode: 'none' },
  { id: 'coin-flip', name: 'Coin Flip', icon: '🪙', category: 'fun', subcategory: 'Random', tags: ['coin'], description: 'Heads or tails', inputMode: 'none' },
  { id: 'rps', name: 'Rock Paper Scissors', icon: '✊', category: 'fun', subcategory: 'Game', tags: ['rps'], description: 'Rock paper scissors', inputMode: 'none' },
  { id: 'buzzword-bingo', name: 'Buzzword Bingo', icon: '📢', category: 'fun', subcategory: 'Meeting', tags: ['bingo'], description: 'Meeting bingo', inputMode: 'none' },
  { id: 'compliment', name: 'Compliment Bot', icon: '💝', category: 'fun', subcategory: 'Dev', tags: ['compliment'], description: 'Dev compliment', inputMode: 'none' },
  { id: 'threat-level', name: 'Threat Level', icon: '🚨', category: 'fun', subcategory: 'Security', tags: ['threat'], description: 'LUL Threat Meter', inputMode: 'none' },

  // TEXT batch
  { id: 'txt-upper', name: 'UPPERCASE', icon: '🔠', category: 'text', subcategory: 'Case', tags: ['upper'], description: 'Uppercase letters', inputMode: 'single' },
  { id: 'txt-lower', name: 'lowercase', icon: '🔡', category: 'text', subcategory: 'Case', tags: ['lower'], description: 'Lowercase letters', inputMode: 'single' },
  { id: 'txt-title', name: 'Title Case', icon: '🔤', category: 'text', subcategory: 'Case', tags: ['title'], description: 'Title case', inputMode: 'single' },
  { id: 'txt-camel', name: 'camelCase', icon: '🐫', category: 'text', subcategory: 'Case', tags: ['camel'], description: 'camelCase', inputMode: 'single' },
  { id: 'txt-pascal', name: 'PascalCase', icon: '🅿️', category: 'text', subcategory: 'Case', tags: ['pascal'], description: 'PascalCase', inputMode: 'single' },
  { id: 'txt-snake', name: 'snake_case', icon: '🐍', category: 'text', subcategory: 'Case', tags: ['snake'], description: 'snake_case', inputMode: 'single' },
  { id: 'txt-kebab', name: 'kebab-case', icon: '🍢', category: 'text', subcategory: 'Case', tags: ['kebab'], description: 'kebab-case', inputMode: 'single' },
  { id: 'txt-reverse', name: 'Reverse Text', icon: '🔃', category: 'text', subcategory: 'Transform', tags: ['reverse'], description: 'Reverse text', inputMode: 'single' },
  { id: 'txt-reverse-words', name: 'Reverse Words', icon: '🔀', category: 'text', subcategory: 'Transform', tags: ['words'], description: 'Reverse word order', inputMode: 'single' },
  { id: 'txt-trim', name: 'Trim', icon: '✂️', category: 'text', subcategory: 'Clean', tags: ['trim'], description: 'Trim whitespace', inputMode: 'single' },
  { id: 'txt-trim-lines', name: 'Trim Lines', icon: '✂️', category: 'text', subcategory: 'Clean', tags: ['trim'], description: 'Trim each line', inputMode: 'textarea' },
  { id: 'txt-line-numbers', name: 'Add Line Numbers', icon: '🔢', category: 'text', subcategory: 'Lines', tags: ['numbers'], description: 'Line numbers', inputMode: 'textarea' },
  { id: 'txt-remove-numbers', name: 'Remove Numbers', icon: '🚫', category: 'text', subcategory: 'Clean', tags: ['numbers'], description: 'Remove digits', inputMode: 'single' },
  { id: 'txt-extract-numbers', name: 'Extract Numbers', icon: '🔢', category: 'text', subcategory: 'Extract', tags: ['numbers'], description: 'Extract numbers', inputMode: 'textarea' },
  { id: 'txt-extract-hashtags', name: 'Extract Hashtags', icon: '#️⃣', category: 'text', subcategory: 'Extract', tags: ['hashtag'], description: 'Find hashtags', inputMode: 'textarea' },
  { id: 'txt-word-count', name: 'Word Count', icon: '📊', category: 'text', subcategory: 'Analyze', tags: ['count'], description: 'Words/chars/lines', inputMode: 'textarea' },
  { id: 'txt-char-count-no-spaces', name: 'Chars No Spaces', icon: '📊', category: 'text', subcategory: 'Analyze', tags: ['count'], description: 'Characters without spaces', inputMode: 'single' },
  { id: 'txt-slug', name: 'Slugify', icon: '🔗', category: 'text', subcategory: 'Transform', tags: ['slug'], description: 'Generate URL slug', inputMode: 'single' },
  { id: 'txt-repeat', name: 'Repeat String', icon: '🔁', category: 'text', subcategory: 'Transform', tags: ['repeat'], description: 'Repeat text N times', inputMode: 'dual', placeholder: 'ha', placeholder2: '3' },
  { id: 'txt-truncate', name: 'Truncate', icon: '✂️', category: 'text', subcategory: 'Transform', tags: ['truncate'], description: 'Truncate text', inputMode: 'dual', placeholder2: '80' },
  { id: 'txt-base64-enc', name: 'Base64 Encode', icon: '🔐', category: 'encoding', subcategory: 'Base64', tags: ['base64'], description: 'Encode Base64', inputMode: 'single' },
  { id: 'txt-base64-dec', name: 'Base64 Decode', icon: '🔓', category: 'encoding', subcategory: 'Base64', tags: ['base64'], description: 'Decode Base64', inputMode: 'single' },
  { id: 'txt-url-enc', name: 'URL Encode', icon: '🌐', category: 'encoding', subcategory: 'URL', tags: ['url'], description: 'Encode URL', inputMode: 'single' },
  { id: 'txt-url-dec', name: 'URL Decode', icon: '🌐', category: 'encoding', subcategory: 'URL', tags: ['url'], description: 'Decode URL', inputMode: 'single' },
  { id: 'txt-rot13', name: 'ROT13', icon: '🔄', category: 'encoding', subcategory: 'Cipher', tags: ['rot13'], description: 'ROT13', inputMode: 'single' },
  { id: 'txt-rot47', name: 'ROT47', icon: '🔄', category: 'encoding', subcategory: 'Cipher', tags: ['rot47'], description: 'ROT47', inputMode: 'single' },
  { id: 'txt-leet', name: 'Leetspeak', icon: '1337', category: 'encoding', subcategory: 'Fun', tags: ['leet'], description: 'Leetspeak', inputMode: 'single' },
  { id: 'txt-binary-enc', name: 'Text → Binary', icon: '01', category: 'encoding', subcategory: 'Binary', tags: ['binary'], description: 'Text to binary', inputMode: 'single' },
  { id: 'txt-binary-dec', name: 'Binary → Text', icon: '10', category: 'encoding', subcategory: 'Binary', tags: ['binary'], description: 'Binary to text', inputMode: 'single' },
  { id: 'txt-hex-enc', name: 'Text → Hex', icon: 'HEX', category: 'encoding', subcategory: 'Hex', tags: ['hex'], description: 'Text to hex', inputMode: 'single' },
  { id: 'txt-hex-dec', name: 'Hex → Text', icon: 'HEX', category: 'encoding', subcategory: 'Hex', tags: ['hex'], description: 'Hex to text', inputMode: 'single' },
  { id: 'txt-unique-lines', name: 'Unique Lines', icon: '✨', category: 'text', subcategory: 'Lines', tags: ['unique'], description: 'Unique lines', inputMode: 'textarea' },
  { id: 'txt-shuffle-lines', name: 'Shuffle Lines', icon: '🎲', category: 'text', subcategory: 'Lines', tags: ['shuffle'], description: 'Shuffle lines', inputMode: 'textarea' },
  { id: 'txt-sort-by-length', name: 'Sort by Length', icon: '📏', category: 'text', subcategory: 'Lines', tags: ['sort'], description: 'Sort by length', inputMode: 'textarea' },
  { id: 'txt-json-escape', name: 'JSON Escape String', icon: '\\"', category: 'data', subcategory: 'JSON', tags: ['escape'], description: 'Escape string for JSON', inputMode: 'single' },
  { id: 'txt-json-unescape', name: 'JSON Unescape', icon: '\\"', category: 'data', subcategory: 'JSON', tags: ['escape'], description: 'Parse JSON string', inputMode: 'single' },
  { id: 'txt-md-heading', name: 'MD Heading', icon: '#', category: 'text', subcategory: 'Markdown', tags: ['markdown'], description: 'Markdown H1', inputMode: 'single' },
  { id: 'txt-md-bold', name: 'MD Bold', icon: '**', category: 'text', subcategory: 'Markdown', tags: ['markdown'], description: 'Markdown bold', inputMode: 'single' },
  { id: 'txt-md-code', name: 'MD Code', icon: '`', category: 'text', subcategory: 'Markdown', tags: ['markdown'], description: 'Markdown inline code', inputMode: 'single' },
  { id: 'txt-md-link', name: 'MD Link', icon: '🔗', category: 'text', subcategory: 'Markdown', tags: ['markdown'], description: 'Markdown Link', inputMode: 'dual', placeholder2: 'https://' },
  { id: 'txt-query-parse', name: 'Query Parse', icon: '?', category: 'web', subcategory: 'URL', tags: ['query'], description: 'Parse query string', inputMode: 'single', defaultInput: 'a=1&b=2' },
  { id: 'txt-query-build', name: 'Query Build', icon: '?', category: 'web', subcategory: 'URL', tags: ['query'], description: 'Build query from JSON', inputMode: 'textarea', defaultInput: '{"a":"1"}' },
  { id: 'txt-xml-escape', name: 'XML Escape', icon: '&lt;', category: 'encoding', subcategory: 'XML', tags: ['xml'], description: 'Escape XML', inputMode: 'single' },
  { id: 'txt-reading-time', name: 'Reading Time', icon: '⏱️', category: 'text', subcategory: 'Analyze', tags: ['read'], description: 'Estimate reading time', inputMode: 'textarea' },

  // MATH batch
  { id: 'math-factorial', name: 'Factorial', icon: '!', category: 'math', subcategory: 'Number', tags: ['factorial'], description: 'n factorial', inputMode: 'single' },
  { id: 'math-gcd', name: 'GCD', icon: '🔢', category: 'math', subcategory: 'Number', tags: ['gcd'], description: 'GCD', inputMode: 'dual' },
  { id: 'math-lcm', name: 'LCM', icon: '🔢', category: 'math', subcategory: 'Number', tags: ['lcm'], description: 'LCM', inputMode: 'dual' },
  { id: 'math-fib', name: 'Fibonacci', icon: '🐚', category: 'math', subcategory: 'Sequence', tags: ['fib'], description: 'Fibonacci sequence', inputMode: 'single', defaultInput: '10' },
  { id: 'math-roman', name: 'Roman Numeral', icon: '🏛️', category: 'math', subcategory: 'Convert', tags: ['roman'], description: 'Number to Roman', inputMode: 'single' },
  { id: 'math-sqrt', name: 'Square Root', icon: '√', category: 'math', subcategory: 'Calc', tags: ['sqrt'], description: 'Square root', inputMode: 'single' },
  { id: 'math-pow', name: 'Power', icon: '^', category: 'math', subcategory: 'Calc', tags: ['pow'], description: 'Exponentiation', inputMode: 'dual' },
  { id: 'math-abs', name: 'Absolute', icon: '|x|', category: 'math', subcategory: 'Calc', tags: ['abs'], description: 'Absolute value', inputMode: 'single' },
  { id: 'math-round', name: 'Round', icon: '○', category: 'math', subcategory: 'Calc', tags: ['round'], description: 'Round', inputMode: 'single' },
  { id: 'math-floor', name: 'Floor', icon: '⌊', category: 'math', subcategory: 'Calc', tags: ['floor'], description: 'Round down', inputMode: 'single' },
  { id: 'math-ceil', name: 'Ceil', icon: '⌈', category: 'math', subcategory: 'Calc', tags: ['ceil'], description: 'Round up', inputMode: 'single' },
  { id: 'math-mod', name: 'Modulo', icon: '%', category: 'math', subcategory: 'Calc', tags: ['mod'], description: 'Modulo', inputMode: 'dual' },
  { id: 'math-quadratic', name: 'Quadratic', icon: 'x²', category: 'math', subcategory: 'Algebra', tags: ['quadratic'], description: 'ax²+bx+c=0', inputMode: 'single', defaultInput: '1,-3,2' },
  { id: 'math-bmi', name: 'BMI', icon: '⚖️', category: 'math', subcategory: 'Health', tags: ['bmi'], description: 'Body-Mass-Index', inputMode: 'dual', placeholder: 'kg', placeholder2: 'cm' },
  { id: 'math-tip', name: 'Tip Calculator', icon: '💵', category: 'math', subcategory: 'Finance', tags: ['tip'], description: 'Calculate tip', inputMode: 'dual' },
  { id: 'math-compound', name: 'Compound Interest', icon: '📈', category: 'math', subcategory: 'Finance', tags: ['interest'], description: 'Compound interest 10y', inputMode: 'dual' },
  { id: 'math-loan', name: 'Loan Payment', icon: '🏠', category: 'math', subcategory: 'Finance', tags: ['loan'], description: 'Monthly payment', inputMode: 'dual' },
  { id: 'math-primes-up-to', name: 'Primes Up To N', icon: '🔢', category: 'math', subcategory: 'Number', tags: ['primes'], description: 'List primes', inputMode: 'single', defaultInput: '50' },
  { id: 'math-is-even', name: 'Even/Odd', icon: '2', category: 'math', subcategory: 'Number', tags: ['even'], description: 'Even/odd', inputMode: 'single' },
  { id: 'math-is-leap', name: 'Leap Year', icon: '📅', category: 'math', subcategory: 'Calendar', tags: ['leap'], description: 'Leap year?', inputMode: 'single', defaultInput: '2024' },
  { id: 'math-coin-change', name: 'Coin Change', icon: '🪙', category: 'math', subcategory: 'Algo', tags: ['coins'], description: 'Coin change', inputMode: 'single' },
  { id: 'math-distance-2d', name: '2D Distance', icon: '📐', category: 'math', subcategory: 'Geometry', tags: ['distance'], description: 'Distance between 2 points', inputMode: 'dual', placeholder: 'x1,y1', placeholder2: 'x2,y2' },
  { id: 'math-median', name: 'Median', icon: '📊', category: 'math', subcategory: 'Stats', tags: ['median'], description: 'Median', inputMode: 'single' },
  { id: 'math-mean', name: 'Mean Average', icon: '📊', category: 'math', subcategory: 'Stats', tags: ['mean'], description: 'Mean average', inputMode: 'single' },

  // TIME batch
  { id: 'time-days-between', name: 'Days Between', icon: '📆', category: 'time', subcategory: 'Calc', tags: ['days'], description: 'Days between dates', inputMode: 'dual' },
  { id: 'time-add-hours', name: 'Add Hours', icon: '🕐', category: 'time', subcategory: 'Calc', tags: ['hours'], description: 'Add hours', inputMode: 'dual' },
  { id: 'time-add-minutes', name: 'Add Minutes', icon: '🕐', category: 'time', subcategory: 'Calc', tags: ['minutes'], description: 'Add minutes', inputMode: 'dual' },
  { id: 'time-format-de', name: 'Format DE', icon: '🇩🇪', category: 'time', subcategory: 'Format', tags: ['locale'], description: 'de-DE Format', inputMode: 'single' },
  { id: 'time-format-us', name: 'Format US', icon: '🇺🇸', category: 'time', subcategory: 'Format', tags: ['locale'], description: 'en-US Format', inputMode: 'single' },
  { id: 'time-unix-now', name: 'Unix Now', icon: '⏱️', category: 'time', subcategory: 'Unix', tags: ['unix'], description: 'Current Unix timestamp', inputMode: 'none' },
  { id: 'time-unix-to-iso', name: 'Unix → ISO', icon: '⏱️', category: 'time', subcategory: 'Unix', tags: ['unix'], description: 'Unix to ISO', inputMode: 'single' },
  { id: 'time-iso-to-unix', name: 'ISO → Unix', icon: '⏱️', category: 'time', subcategory: 'Unix', tags: ['unix'], description: 'ISO to Unix', inputMode: 'single' },
  { id: 'time-quarter', name: 'Quarter', icon: 'Q', category: 'time', subcategory: 'Calendar', tags: ['quarter'], description: 'Quarter', inputMode: 'single' },
  { id: 'time-day-of-year', name: 'Day of Year', icon: '📅', category: 'time', subcategory: 'Calendar', tags: ['doy'], description: 'Day of year', inputMode: 'single' },
  { id: 'time-weekend-check', name: 'Weekend Check', icon: '🎉', category: 'time', subcategory: 'Calendar', tags: ['weekend'], description: 'Weekend?', inputMode: 'single' },
  { id: 'time-timezone-offset', name: 'TZ Offset', icon: '🌍', category: 'time', subcategory: 'Timezone', tags: ['tz'], description: 'Local UTC offset', inputMode: 'none' },

  // SECURITY extra
  { id: 'sec-pwd-gen', name: 'Password Generator', icon: '🔑', category: 'security', subcategory: 'Password', tags: ['generate'], description: 'Secure password', inputMode: 'single', defaultInput: '16' },
  { id: 'sec-pin-gen', name: 'PIN Generator', icon: '🔢', category: 'security', subcategory: 'Password', tags: ['pin'], description: '6-digit PIN', inputMode: 'none' },
  { id: 'sec-api-key', name: 'API Key', icon: '🗝️', category: 'security', subcategory: 'IDs', tags: ['api'], description: 'API key format', inputMode: 'none' },
  { id: 'sec-entropy', name: 'Entropy Estimate', icon: '📊', category: 'security', subcategory: 'Analyze', tags: ['entropy'], description: 'Password entropy', inputMode: 'single' },
  { id: 'sec-xor', name: 'XOR Cipher', icon: '⊕', category: 'security', subcategory: 'Cipher', tags: ['xor'], description: 'XOR with key', inputMode: 'dual', placeholder2: 'key' },
  { id: 'sec-bcrypt-note', name: 'bcrypt Note', icon: 'ℹ️', category: 'security', subcategory: 'Info', tags: ['bcrypt'], description: 'bcrypt note', inputMode: 'none' },

  // DEV
  { id: 'dev-regex-test', name: 'Regex Tester', icon: '.*', category: 'dev', subcategory: 'Regex', tags: ['regex'], description: 'Test regex', inputMode: 'dual', placeholder: 'text', placeholder2: 'pattern' },
  { id: 'dev-semver-compare', name: 'Semver Compare', icon: '📦', category: 'dev', subcategory: 'Version', tags: ['semver'], description: 'Compare versions', inputMode: 'dual', defaultInput: '1.2.3', placeholder2: '1.3.0' },
  { id: 'dev-branch-name', name: 'Branch Name', icon: '🌿', category: 'dev', subcategory: 'Git', tags: ['git'], description: 'Git branch idea', inputMode: 'none' },
  { id: 'dev-commit-msg', name: 'Commit Message', icon: '💬', category: 'dev', subcategory: 'Git', tags: ['git'], description: 'Commit message', inputMode: 'none' },
  { id: 'dev-docker-name', name: 'Docker Image Name', icon: '🐳', category: 'dev', subcategory: 'Docker', tags: ['docker'], description: 'Image name', inputMode: 'none' },
  { id: 'dev-env-line', name: '.env Line', icon: '⚙️', category: 'dev', subcategory: 'Config', tags: ['env'], description: 'Build .env line', inputMode: 'dual' },
  { id: 'dev-json-pretty', name: 'JSON Pretty (dev)', icon: '{ }', category: 'dev', subcategory: 'JSON', tags: ['json'], description: 'JSON format', inputMode: 'textarea' },
  { id: 'dev-uuid-nil', name: 'Nil UUID', icon: '0', category: 'dev', subcategory: 'IDs', tags: ['uuid'], description: 'Nil UUID', inputMode: 'none' },
  { id: 'dev-chmod-num', name: 'chmod Octal', icon: '🔐', category: 'dev', subcategory: 'Unix', tags: ['chmod'], description: 'Explain chmod', inputMode: 'single', defaultInput: '755' },

  // GENERATORS extra
  { id: 'gen-startup', name: 'Startup Name', icon: '🚀', category: 'generators', subcategory: 'Business', tags: ['startup'], description: 'Startup + .io', inputMode: 'none' },
  { id: 'gen-product', name: 'Product Name', icon: '📦', category: 'generators', subcategory: 'Business', tags: ['product'], description: 'Product name', inputMode: 'none' },
  { id: 'gen-app', name: 'App Name', icon: '📱', category: 'generators', subcategory: 'Business', tags: ['app'], description: 'App name', inputMode: 'none' },
  { id: 'gen-podcast', name: 'Podcast Name', icon: '🎙️', category: 'generators', subcategory: 'Creative', tags: ['podcast'], description: 'Podcast title', inputMode: 'none' },
  { id: 'gen-project', name: 'Project Codename', icon: '📁', category: 'generators', subcategory: 'Business', tags: ['project'], description: 'Project name', inputMode: 'none' },
  { id: 'gen-codename', name: 'Ops Codename', icon: '🕵️', category: 'generators', subcategory: 'Creative', tags: ['codename'], description: 'Secret codename', inputMode: 'none' },
  { id: 'gen-color-name', name: 'Color Name', icon: '🎨', category: 'generators', subcategory: 'Design', tags: ['color'], description: 'Color name idea', inputMode: 'none' },
  { id: 'gen-fake-phone', name: 'Fake Phone DE', icon: '📱', category: 'generators', subcategory: 'Contact', tags: ['phone'], description: 'Test phone number', inputMode: 'none' },
  { id: 'gen-fake-address', name: 'Fake Address DE', icon: '🏠', category: 'generators', subcategory: 'Contact', tags: ['address'], description: 'Test address', inputMode: 'none' },
  { id: 'gen-fake-company', name: 'Fake Company', icon: '🏢', category: 'generators', subcategory: 'Business', tags: ['company'], description: 'Company name', inputMode: 'none' },
  { id: 'gen-lottery', name: 'Lottery Numbers', icon: '🎰', category: 'generators', subcategory: 'Random', tags: ['lottery'], description: '6 from 49', inputMode: 'none' },
  { id: 'gen-password-pin', name: 'PIN Pair', icon: '🔢', category: 'generators', subcategory: 'Random', tags: ['pin'], description: 'PIN combination', inputMode: 'none' },
  { id: 'gen-uuid-bulk-50', name: 'Bulk UUID ×50', icon: '📋', category: 'generators', subcategory: 'IDs', tags: ['uuid'], description: '50 UUIDs', inputMode: 'none' },
  { id: 'gen-markov-quote', name: 'Tech Quote', icon: '💬', category: 'generators', subcategory: 'Creative', tags: ['quote'], description: 'Tech wisdom', inputMode: 'none' },
  { id: 'gen-would-you-rather', name: 'Would You Rather', icon: '🤔', category: 'fun', subcategory: 'Game', tags: ['wyr'], description: 'Would you rather (dev)', inputMode: 'none' },
  { id: 'gen-tarot', name: 'Tarot Card', icon: '🃏', category: 'fun', subcategory: 'Oracle', tags: ['tarot'], description: 'Tarot card', inputMode: 'none' },
  { id: 'gen-ascii-border', name: 'ASCII Border', icon: '╔╗', category: 'text', subcategory: 'ASCII', tags: ['ascii'], description: 'ASCII border', inputMode: 'single', defaultInput: 'LUL' },

  // Custom UI
  { id: 'stopwatch', name: 'Stopwatch', icon: '⏱️', category: 'time', subcategory: 'Timer', tags: ['stopwatch'], description: 'Stopwatch', inputMode: 'custom', customUi: 'stopwatch' },
  { id: 'countdown', name: 'Countdown', icon: '⏳', category: 'time', subcategory: 'Timer', tags: ['countdown'], description: 'Countdown', inputMode: 'custom', customUi: 'countdown' },
  { id: 'dice-roll', name: 'Dice Roller', icon: '🎲', category: 'fun', subcategory: 'Game', tags: ['dice'], description: 'Dice D4–D100', inputMode: 'custom', customUi: 'dice' },
];

function buildReferenceTools(): ToolDefinition[] {
  const out: ToolDefinition[] = [];

  for (const [code, label] of Object.entries(HTTP_STATUS)) {
    out.push({
      id: `ref-http-${code}`, name: `HTTP ${code}`, icon: '🌐', category: 'reference', subcategory: 'HTTP',
      tags: ['http', code, label.toLowerCase()], description: label, inputMode: 'none',
    });
  }

  for (const [code, name] of Object.entries(COUNTRIES)) {
    out.push({
      id: `ref-country-${code.toLowerCase()}`, name: `Country ${code}`, icon: '🏳️', category: 'reference', subcategory: 'Geo',
      tags: ['country', code.toLowerCase(), name.toLowerCase()], description: name, inputMode: 'none',
    });
  }

  for (const [code, name] of Object.entries(CURRENCIES)) {
    out.push({
      id: `ref-currency-${code.toLowerCase()}`, name: `Currency ${code}`, icon: '💱', category: 'reference', subcategory: 'Finance',
      tags: ['currency', code.toLowerCase()], description: name, inputMode: 'none',
    });
  }

  for (const [ext, mime] of Object.entries(MIME_EXT)) {
    out.push({
      id: `ref-mime-${ext}`, name: `MIME .${ext}`, icon: '📄', category: 'reference', subcategory: 'MIME',
      tags: ['mime', ext], description: mime, inputMode: 'none',
    });
  }

  for (const [cmd, desc] of Object.entries(GIT_COMMANDS)) {
    out.push({
      id: `ref-git-${slugify(cmd).slice(0, 40)}`, name: cmd, icon: '🌿', category: 'reference', subcategory: 'Git',
      tags: ['git', ...cmd.split(/\s+/)], description: desc, inputMode: 'none',
    });
  }

  for (const [cmd, desc] of Object.entries(DOCKER_COMMANDS)) {
    out.push({
      id: `ref-docker-${slugify(cmd).slice(0, 30)}`, name: cmd, icon: '🐳', category: 'reference', subcategory: 'Docker',
      tags: ['docker', ...cmd.split(/\s+/)], description: desc, inputMode: 'none',
    });
  }

  for (const [cmd, desc] of Object.entries(LINUX_COMMANDS)) {
    out.push({
      id: `ref-linux-${cmd}`, name: cmd, icon: '🐧', category: 'reference', subcategory: 'Linux',
      tags: ['linux', cmd], description: desc, inputMode: 'none',
    });
  }

  for (const [kw, desc] of Object.entries(SQL_KEYWORDS)) {
    out.push({
      id: `ref-sql-${kw.toLowerCase()}`, name: `SQL ${kw}`, icon: '🗄️', category: 'reference', subcategory: 'SQL',
      tags: ['sql', kw.toLowerCase()], description: desc, inputMode: 'none',
    });
  }

  for (const [kw, em] of Object.entries(EMOJI_MAP)) {
    out.push({
      id: `ref-emoji-${kw}`, name: `Emoji ${kw}`, icon: em, category: 'reference', subcategory: 'Emoji',
      tags: ['emoji', kw], description: `${kw} → ${em}`, inputMode: 'none',
    });
  }

  for (const [name, pattern] of Object.entries(REGEX_PRESETS)) {
    out.push({
      id: `ref-regex-${name}`, name: `Regex ${name}`, icon: '.*', category: 'reference', subcategory: 'Regex',
      tags: ['regex', name], description: `Test pattern: ${pattern.slice(0, 40)}…`, inputMode: 'single', placeholder: 'test string',
    });
  }

  for (const u of UNIT_PAIRS) {
    out.push({
      id: `unit-${u.id}`, name: u.name, icon: u.icon, category: 'math', subcategory: 'Units',
      tags: ['unit', 'convert', ...u.id.split('-')], description: u.name, inputMode: 'single', placeholder: 'value',
    });
  }

  return out;
}

export const TOOL_VAULT_CATALOG: ToolDefinition[] = [...BASE_TOOLS, ...buildReferenceTools()];

export const TOOL_CATEGORIES: CategoryMeta[] = [
  { id: 'all', label: 'All', icon: '✨' },
  { id: 'text', label: 'Text', icon: '📝' },
  { id: 'data', label: 'Data', icon: '🗃️' },
  { id: 'encoding', label: 'Encoding', icon: '🔤' },
  { id: 'math', label: 'Math', icon: '🔢' },
  { id: 'security', label: 'Security', icon: '🔐' },
  { id: 'design', label: 'Design', icon: '🎨' },
  { id: 'time', label: 'Time', icon: '⏱️' },
  { id: 'web', label: 'Web', icon: '🌐' },
  { id: 'dev', label: 'Dev', icon: '💻' },
  { id: 'network', label: 'Network', icon: '📡' },
  { id: 'generators', label: 'Generators', icon: '🎲' },
  { id: 'reference', label: 'Reference', icon: '📚' },
  { id: 'fun', label: 'Fun', icon: '🎭' },
];

export function getSubcategories(category: ToolDefinition['category'] | 'all') {
  if (category === 'all') return [];
  const subs = new Set(TOOL_VAULT_CATALOG.filter((t) => t.category === category).map((t) => t.subcategory));
  return [...subs].sort();
}

export function getCategoryCounts() {
  const counts: Record<string, number> = { all: TOOL_VAULT_CATALOG.length };
  for (const t of TOOL_VAULT_CATALOG) counts[t.category] = (counts[t.category] ?? 0) + 1;
  return counts;
}