/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { pick, randomInt, slugify } from '../../utils/generators';
import {
  buzzwordCard,
  caesar,
  cidrInfo,
  decodeJwt,
  generateFakeIban,
  httpStatus,
  isoWeek,
  isPrime,
  luhnCheck,
  magic8Ball,
  mimeLookup,
  parseCsvToJson,
  passwordStrength,
  randomCompliment,
  randomExcuse,
  randomHaiku,
  sha1,
  teamName,
  bandName,
  threatLevel,
  toNato,
  uuidV4,
} from '../../utils/toolVaultHelpers';
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
import type { ToolExecutor } from './types';

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha512(text: string) {
  const buf = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function toCamel(s: string) {
  return s.replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^./, (c) => c.toLowerCase());
}

function toPascal(s: string) {
  const c = toCamel(s);
  return c.charAt(0).toUpperCase() + c.slice(1);
}

function toSnake(s: string) {
  return s.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toLowerCase();
}

function toKebab(s: string) {
  return toSnake(s).replace(/_/g, '-');
}

function toTitle(s: string) {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function rot47(s: string) {
  return s.replace(/[!-~]/g, (c) => String.fromCharCode(33 + ((c.charCodeAt(0) - 33 + 47) % 94)));
}

function leet(s: string) {
  return s.replace(/a/gi, '4').replace(/e/gi, '3').replace(/i/gi, '1').replace(/o/gi, '0').replace(/s/gi, '5').replace(/t/gi, '7');
}

function factorial(n: number) {
  if (n < 0) return NaN;
  if (n <= 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

function fib(n: number) {
  const out: number[] = [];
  let a = 0, b = 1;
  for (let i = 0; i < n; i++) { out.push(a); [a, b] = [b, a + b]; }
  return out.join(', ');
}

function roman(n: number) {
  const map: [number, string][] = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let out = '';
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}

const NAME_ADJECTIVES = ['Quantum', 'Neon', 'Silent', 'Turbo', 'Cosmic', 'Pixel', 'Shadow', 'Hyper', 'Velvet', 'Static', 'Digital', 'Phantom', 'Solar', 'Lunar', 'Cyber'];
const NAME_NOUNS = ['Nexus', 'Forge', 'Pulse', 'Beacon', 'Relay', 'Socket', 'Kernel', 'Mirage', 'Vector', 'Protocol', 'Engine', 'Matrix', 'Circuit', 'Node', 'Stack'];

function genName() {
  return `${pick(NAME_ADJECTIVES)} ${pick(NAME_NOUNS)}`;
}

const EXECUTORS: Record<string, ToolExecutor> = {
  'json-format': (i) => { try { return JSON.stringify(JSON.parse(i), null, 2); } catch { return 'Invalid JSON'; } },
  'json-minify': (i) => { try { return JSON.stringify(JSON.parse(i)); } catch { return 'Invalid JSON'; } },
  'csv-json': (i) => parseCsvToJson(i),
  'line-sorter': (i) => i.split('\n').sort((a, b) => a.localeCompare(b)).join('\n'),
  'line-sorter-desc': (i) => i.split('\n').sort((a, b) => b.localeCompare(a)).join('\n'),
  'email-extract': (i) => [...new Set(i.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? [])].join('\n') || '(none)',
  'url-extract': (i) => [...new Set(i.match(/https?:\/\/[^\s]+/g) ?? [])].join('\n') || '(none)',
  'palindrome': (i) => { const c = i.toLowerCase().replace(/[^a-z0-9]/g, ''); return c && c === c.split('').reverse().join('') ? '✓ Palindrome' : '✗ Not palindrome'; },
  'empty-lines': (i) => i.split('\n').filter((l) => l.trim()).join('\n'),
  'unit-length': (i) => { const km = parseFloat(i) || 0; return `km:${km} mi:${(km*0.621371).toFixed(4)} m:${km*1000} ft:${(km*3280.84).toFixed(2)}`; },
  'temp-convert': (i) => { const c = parseFloat(i)||0; return `C:${c} F:${(c*9/5+32).toFixed(2)} K:${(c+273.15).toFixed(2)}`; },
  'percentage': (i, i2) => `${parseFloat(i)||0}% of ${parseFloat(i2)||0} = ${((parseFloat(i)||0)/100*(parseFloat(i2)||0)).toFixed(4)}`,
  'random-range': (i, i2) => String(randomInt(Math.min(parseInt(i,10)||0, parseInt(i2,10)||100), Math.max(parseInt(i,10)||0, parseInt(i2,10)||100))),
  'prime-check': (i) => { const n=parseInt(i,10); return Number.isNaN(n)?'Enter number':isPrime(n)?`${n} is PRIME`:`${n} NOT prime`; },
  'uuid-gen': () => uuidV4(),
  'pwd-strength': (i) => { const r=passwordStrength(i); return `Score:${r.score}/5 ${r.label}\n${'█'.repeat(r.score)}${'░'.repeat(5-r.score)}`; },
  'jwt-decode': (i) => { try { return JSON.stringify(decodeJwt(i),null,2); } catch(e){ return e instanceof Error?e.message:'fail'; } },
  'luhn-check': (i) => luhnCheck(i) ? '✓ Valid Luhn' : '✗ Invalid Luhn',
  'sha1-hash': (i) => sha1(i),
  'sha256-hash': (i) => sha256(i),
  'sha512-hash': (i) => sha512(i),
  'bin-hex': (i) => /^[01\s]+$/.test(i.trim()) ? `HEX:${parseInt(i.replace(/\s/g,''),2).toString(16).toUpperCase()}` : `BIN:${parseInt(i.replace(/\s/g,''),16).toString(2)}`,
  'caesar-cipher': (i, _, e) => caesar(i, parseInt(e.shift||'3',10)||0),
  'css-gradient': (i, i2) => `background:linear-gradient(135deg,${i||'#6366f1'},${i2||'#22d3ee'});`,
  'aspect-ratio': (i, i2) => { const w=parseFloat(i)||16,h=parseFloat(i2)||9; return `Ratio:${(w/h).toFixed(4)} (${w}:${h})`; },
  'screen-info': () => `Screen:${screen.width}×${screen.height}\nViewport:${window.innerWidth}×${window.innerHeight}\nDPR:${devicePixelRatio}`,
  'box-shadow': (i, i2) => `box-shadow:${i||'4'}px ${i2||'4'}px ${(parseInt(i||'4',10))*3}px rgba(99,102,241,0.35);`,
  'hex-brightness': (i) => { const h=i.replace('#',''); if(h.length!==6)return '6-digit HEX'; const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16); const br=(r*299+g*587+b*114)/1000; return `Brightness:${br.toFixed(1)} → ${br>128?'LIGHT':'DARK'}`; },
  'age-calc': (i) => { const b=new Date(i),n=new Date(); if(Number.isNaN(b.getTime()))return 'Invalid'; let a=n.getFullYear()-b.getFullYear(); if(n.getMonth()<b.getMonth()||(n.getMonth()===b.getMonth()&&n.getDate()<b.getDate()))a--; return `${a} years`; },
  'iso-week': (i) => `ISO Week: ${isoWeek(new Date(i||Date.now()))}`,
  'add-days': (i, i2) => { const d=new Date(i); if(Number.isNaN(d.getTime()))return 'Invalid'; d.setDate(d.getDate()+(parseInt(i2,10)||0)); return d.toISOString().split('T')[0]; },
  'http-status': (i) => `${i}: ${httpStatus(i)}`,
  'mime-lookup': (i) => mimeLookup(i),
  'cidr-calc': (i, i2) => { const info=cidrInfo(i,parseInt(i2,10)||24); return info?`Net:${info.network}/${info.prefix}\nHosts:${info.hosts}`:'Invalid IPv4'; },
  'user-agent': () => navigator.userAgent,
  'mac-format': (i) => i.replace(/[^a-fA-F0-9]/g,'').toUpperCase().match(/.{1,2}/g)?.join(':')??'Invalid',
  'html-entities': (i) => i.includes('&') ? (new DOMParser().parseFromString(i,'text/html').documentElement.textContent??'') : i.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),
  'fake-iban': () => generateFakeIban(),
  'team-name': () => teamName(),
  'band-name': () => bandName(),
  'haiku-gen': () => randomHaiku(),
  'nato-alpha': (i) => toNato(i),
  'bulk-uuid': () => Array.from({length:10},()=>uuidV4()).join('\n'),
  'dev-excuse': () => randomExcuse(),
  'magic-8ball': () => `🎱 ${magic8Ball()}`,
  'coin-flip': () => pick(['Heads 🪙','Tails 🪙']),
  'rps': () => { const m=['Rock ✊','Paper ✋','Scissors ✌️']; return `You:${pick(m)}\nCPU:${pick(m)}`; },
  'buzzword-bingo': () => buzzwordCard(),
  'compliment': () => `💝 ${randomCompliment()}`,
  'threat-level': () => `🚨 ${threatLevel()}`,

  // TEXT transforms
  'txt-upper': (i) => i.toUpperCase(),
  'txt-lower': (i) => i.toLowerCase(),
  'txt-title': (i) => toTitle(i),
  'txt-camel': (i) => toCamel(i),
  'txt-pascal': (i) => toPascal(i),
  'txt-snake': (i) => toSnake(i),
  'txt-kebab': (i) => toKebab(i),
  'txt-reverse': (i) => i.split('').reverse().join(''),
  'txt-reverse-words': (i) => i.split(/\s+/).reverse().join(' '),
  'txt-trim': (i) => i.trim(),
  'txt-trim-lines': (i) => i.split('\n').map((l)=>l.trim()).join('\n'),
  'txt-line-numbers': (i) => i.split('\n').map((l,n)=>`${n+1}| ${l}`).join('\n'),
  'txt-remove-numbers': (i) => i.replace(/\d+/g,''),
  'txt-extract-numbers': (i) => (i.match(/-?\d+\.?\d*/g)??[]).join('\n')||'(none)',
  'txt-extract-hashtags': (i) => (i.match(/#\w+/g)??[]).join('\n')||'(none)',
  'txt-word-count': (i) => `Words:${i.trim()?i.trim().split(/\s+/).length:0} Chars:${i.length} Lines:${i.split('\n').length}`,
  'txt-char-count-no-spaces': (i) => `Chars(no space):${i.replace(/\s/g,'').length}`,
  'txt-slug': (i) => slugify(i),
  'txt-repeat': (i, i2) => i.repeat(Math.min(parseInt(i2,10)||1,50)),
  'txt-truncate': (i, i2) => i.slice(0, parseInt(i2,10)||80)+(i.length>(parseInt(i2,10)||80)?'…':''),
  'txt-base64-enc': (i) => btoa(unescape(encodeURIComponent(i))),
  'txt-base64-dec': (i) => { try{return decodeURIComponent(escape(atob(i)));}catch{return 'Invalid Base64';} },
  'txt-url-enc': (i) => encodeURIComponent(i),
  'txt-url-dec': (i) => { try{return decodeURIComponent(i);}catch{return 'Invalid';} },
  'txt-rot13': (i) => caesar(i, 13),
  'txt-rot47': (i) => rot47(i),
  'txt-leet': (i) => leet(i),
  'txt-binary-enc': (i) => i.split('').map((c)=>c.charCodeAt(0).toString(2).padStart(8,'0')).join(' '),
  'txt-binary-dec': (i) => { try{return i.split(/\s+/).map(b=>String.fromCharCode(parseInt(b,2))).join('');}catch{return 'Invalid binary';} },
  'txt-hex-enc': (i) => [...i].map(c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join(' '),
  'txt-hex-dec': (i) => { try{return i.split(/\s+/).map(h=>String.fromCharCode(parseInt(h,16))).join('');}catch{return 'Invalid hex';} },
  'txt-unique-lines': (i) => [...new Set(i.split('\n'))].join('\n'),
  'txt-shuffle-lines': (i) => i.split('\n').sort(()=>Math.random()-0.5).join('\n'),
  'txt-sort-by-length': (i) => i.split('\n').sort((a,b)=>a.length-b.length).join('\n'),
  'txt-json-escape': (i) => JSON.stringify(i),
  'txt-json-unescape': (i) => { try{return JSON.parse(i);}catch{return 'Invalid JSON string';} },
  'txt-md-heading': (i) => `# ${i}`,
  'txt-md-bold': (i) => `**${i}**`,
  'txt-md-code': (i) => `\`${i}\``,
  'txt-md-link': (i, i2) => `[${i}](${i2||'https://example.com'})`,
  'txt-query-parse': (i) => JSON.stringify(Object.fromEntries(new URLSearchParams(i.startsWith('?')?i.slice(1):i)),null,2),
  'txt-query-build': (i) => { try{const o=JSON.parse(i);return '?'+new URLSearchParams(o).toString();}catch{return 'Invalid JSON object';} },
  'txt-xml-escape': (i) => i.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
  'txt-reading-time': (i) => { const w=i.trim()?i.trim().split(/\s+/).length:0; return `${Math.max(1,Math.ceil(w/200))} min read (${w} words)`; },

  // MATH
  'math-factorial': (i) => String(factorial(parseInt(i,10)||0)),
  'math-gcd': (i, i2) => String(gcd(parseInt(i,10)||0, parseInt(i2,10)||0)),
  'math-lcm': (i, i2) => { const a=parseInt(i,10)||0,b=parseInt(i2,10)||0; return String(Math.abs(a*b)/gcd(a,b)||0); },
  'math-fib': (i) => fib(Math.min(parseInt(i,10)||10,30)),
  'math-roman': (i) => roman(parseInt(i,10)||0)||'Invalid',
  'math-sqrt': (i) => String(Math.sqrt(parseFloat(i)||0)),
  'math-pow': (i, i2) => String(Math.pow(parseFloat(i)||0, parseFloat(i2)||2)),
  'math-abs': (i) => String(Math.abs(parseFloat(i)||0)),
  'math-round': (i) => String(Math.round(parseFloat(i)||0)),
  'math-floor': (i) => String(Math.floor(parseFloat(i)||0)),
  'math-ceil': (i) => String(Math.ceil(parseFloat(i)||0)),
  'math-mod': (i, i2) => String((parseFloat(i)||0)%(parseFloat(i2)||1)),
  'math-quadratic': (i, i2) => { const [a,b,c]=i.split(',').map(Number); if(!a)return 'Format: a,b,c'; const d=b*b-4*a*c; return `Δ=${d} x=${d<0?'complex':[(-b+Math.sqrt(d))/(2*a),(-b-Math.sqrt(d))/(2*a)].map(v=>v.toFixed(4)).join(', ')}`; },
  'math-bmi': (i, i2) => { const kg=parseFloat(i)||70,cm=parseFloat(i2)||170; const bmi=kg/((cm/100)**2); return `BMI:${bmi.toFixed(2)} (${bmi<18.5?'underweight':bmi<25?'normal':bmi<30?'overweight':'obese'})`; },
  'math-tip': (i, i2) => { const bill=parseFloat(i)||0,pct=parseFloat(i2)||15; return `Tip:${(bill*pct/100).toFixed(2)} Total:${(bill*(1+pct/100)).toFixed(2)}`; },
  'math-compound': (i, i2) => { const p=parseFloat(i)||1000,r=(parseFloat(i2)||5)/100/12,n=12*10; return `Future:${(p*Math.pow(1+r,n)).toFixed(2)} (10y @${parseFloat(i2)||5}%)`; },
  'math-loan': (i, i2) => { const p=parseFloat(i)||200000,r=(parseFloat(i2)||3.5)/100/12,n=360; const m=p*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1); return `Monthly:${m.toFixed(2)}`; },
  'math-primes-up-to': (i) => { const n=Math.min(parseInt(i,10)||50,500); const out:number[]=[]; for(let k=2;k<=n;k++)if(isPrime(k))out.push(k); return out.join(', '); },
  'math-is-even': (i) => (parseInt(i,10)%2===0)?'Even':'Odd',
  'math-is-leap': (i) => { const y=parseInt(i,10); return (y%4===0&&y%100!==0)||y%400===0?'Leap year':'Not leap'; },
  'math-coin-change': (i) => { let c=parseInt(i,10)||0; const coins=[200,100,50,20,10,5,2,1]; const r:string[]=[]; for(const coin of coins){const n=Math.floor(c/coin);if(n){r.push(`${coin}¢×${n}`);c-=n*coin;}} return r.join(' ')||'0'; },
  'math-distance-2d': (i, i2) => { const [x1,y1,x2,y2]=[...i.split(','),...i2.split(',')].map(Number); return `Distance:${Math.hypot((x2||0)-(x1||0),(y2||0)-(y1||0)).toFixed(4)}`; },
  'math-median': (i) => { const a=i.split(/[\s,]+/).map(Number).filter(n=>!Number.isNaN(n)).sort((x,y)=>x-y); if(!a.length)return 'No numbers'; const m=Math.floor(a.length/2); return String(a.length%2?a[m]:(a[m-1]+a[m])/2); },
  'math-mean': (i) => { const a=i.split(/[\s,]+/).map(Number).filter(n=>!Number.isNaN(n)); return a.length?String(a.reduce((s,n)=>s+n,0)/a.length):'No numbers'; },

  // TIME
  'time-days-between': (i, i2) => { const a=new Date(i),b=new Date(i2); if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime()))return 'Invalid dates'; return `${Math.abs(Math.floor((b.getTime()-a.getTime())/86400000))} days`; },
  'time-add-hours': (i, i2) => { const d=new Date(i); d.setHours(d.getHours()+(parseInt(i2,10)||0)); return d.toISOString(); },
  'time-add-minutes': (i, i2) => { const d=new Date(i); d.setMinutes(d.getMinutes()+(parseInt(i2,10)||0)); return d.toISOString(); },
  'time-format-de': (i) => new Date(i||Date.now()).toLocaleString('de-DE'),
  'time-format-us': (i) => new Date(i||Date.now()).toLocaleString('en-US'),
  'time-unix-now': () => String(Math.floor(Date.now()/1000)),
  'time-unix-to-iso': (i) => new Date((parseInt(i,10)||0)*1000).toISOString(),
  'time-iso-to-unix': (i) => String(Math.floor(new Date(i).getTime()/1000)),
  'time-quarter': (i) => { const d=new Date(i||Date.now()); return `Q${Math.floor(d.getMonth()/3)+1} ${d.getFullYear()}`; },
  'time-day-of-year': (i) => { const d=new Date(i||Date.now()); const start=new Date(d.getFullYear(),0,0); return String(Math.floor((d.getTime()-start.getTime())/86400000)); },
  'time-weekend-check': (i) => { const d=new Date(i||Date.now()); const day=d.getDay(); return day===0||day===6?'Weekend 🎉':'Weekday 💼'; },
  'time-timezone-offset': () => `UTC${new Date().getTimezoneOffset()<=0?'+':''}${-new Date().getTimezoneOffset()/60}`,

  // SECURITY
  'sec-pwd-gen': (i) => { const len=Math.min(Math.max(parseInt(i,10)||16,8),64); const c='abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*'; return Array.from({length:len},()=>pick(c.split(''))).join(''); },
  'sec-pin-gen': () => String(randomInt(100000,999999)),
  'sec-api-key': () => `lul_${crypto.randomUUID().replace(/-/g,'')}`,
  'sec-entropy': (i) => { const uniq=new Set(i).size; return `Length:${i.length} Unique:${uniq} Entropy≈${(i.length*Math.log2(uniq||1)).toFixed(2)} bits`; },
  'sec-xor': (i, i2) => [...i].map((c, n) => String.fromCharCode(c.charCodeAt(0) ^ i2.charCodeAt(n % i2.length))).join(''),
  'sec-bcrypt-note': () => 'bcrypt requires server-side library. Use SHA-256 for client-side fingerprint only.',

  // DEV
  'dev-regex-test': (i, i2) => { try{const re=new RegExp(i2,i.includes('(?i)')?'i':''); return re.test(i)?'✓ Match':'✗ No match';}catch(e){return e instanceof Error?e.message:'Invalid regex';} },
  'dev-semver-compare': (i, i2) => { const p=(s:string)=>s.split('.').map(Number); const a=p(i),b=p(i2); for(let k=0;k<3;k++){if((a[k]||0)>(b[k]||0))return `${i} > ${i2}`; if((a[k]||0)<(b[k]||0))return `${i} < ${i2}`;} return 'Equal'; },
  'dev-branch-name': () => `${pick(['feat','fix','chore','refactor'])}/${slugify(genName())}`,
  'dev-commit-msg': () => `${pick(['feat','fix','docs','style','refactor','test','chore'])}: ${pick(['update','fix','improve','refactor'])} ${slugify(genName()).replace(/-/g,' ')}`,
  'dev-docker-name': () => slugify(genName()).toLowerCase(),
  'dev-env-line': (i, i2) => `${i.toUpperCase().replace(/\s/g,'_')}=${i2||'value'}`,
  'dev-json-pretty': (i) => EXECUTORS['json-format'](i,'',{}),
  'dev-uuid-nil': () => '00000000-0000-0000-0000-000000000000',
  'dev-chmod-num': (i) => { const n=parseInt(i,8); if(Number.isNaN(n))return 'Octal e.g. 755'; const r=[(n&4)?'r':'-',(n&2)?'w':'-',(n&1)?'x':'-'].join(''); return `Owner:${r} (${n.toString(8)})`; },

  // GENERATORS (named)
  'gen-startup': () => `${genName()}.io`,
  'gen-product': () => genName(),
  'gen-app': () => `${pick(['Super','Ultra','Mega','Mini','Pro'])}${pick(NAME_NOUNS)}`,
  'gen-podcast': () => `The ${pick(NAME_ADJECTIVES)} ${pick(['Podcast','Show','Hour','Cast'])}`,
  'gen-project': () => `${pick(['Project','Operation','Mission'])} ${pick(NAME_NOUNS)}`,
  'gen-codename': () => pick(['Falcon','Nightjar','Aurora','Blackwood','Nebula','Orion','Phoenix','Cascade']),
  'gen-color-name': () => pick(['Midnight Indigo','Neon Cyan','Amber Glow','Slate Storm','Rose Quartz','Emerald Haze']),
  'gen-fake-phone': () => `+49 ${randomInt(150,179)} ${randomInt(1000000,9999999)}`,
  'gen-fake-address': () => `${randomInt(1,120)} ${pick(['Harbor','Mountain','Forest','Lake'])} Street, ${pick(['Portland','Austin','Denver','Chicago'])} ${randomInt(10000,99999)}`,
  'gen-fake-company': () => `${genName()} ${pick(['GmbH','AG','Labs','Systems'])}`,
  'gen-lottery': () => Array.from({length:6},()=>randomInt(1,49)).sort((a,b)=>a-b).join(' - '),
  'gen-password-pin': () => `${randomInt(1000,9999)}-${randomInt(1000,9999)}`,
  'gen-uuid-bulk-50': () => Array.from({length:50},()=>uuidV4()).join('\n'),
  'gen-markov-quote': () => pick(['Move fast and fix things.','In cache we trust.','Deploy first, think later.','It is not a bug, it is undocumented.']),
  'gen-would-you-rather': () => pick(['Fix prod at 3am OR rewrite CSS forever?','Merge conflict OR npm peer dependency hell?','Standup meeting OR another standup meeting?']),
  'gen-tarot': () => pick(['The Deploy — success imminent','The Rollback — retreat wisely','The Merge — union of branches','The Outage — darkness before dawn']),
  'gen-ascii-border': (i) => `╔${'═'.repeat(Math.min(i.length+2,40))}╗\n║ ${i.slice(0,38)} ║\n╚${'═'.repeat(Math.min(i.length+2,40))}╝`,
};

// Register unit converters
for (const u of UNIT_PAIRS) {
  EXECUTORS[`unit-${u.id}`] = (i) => {
    const v = parseFloat(i);
    if (Number.isNaN(v)) return 'Enter a number';
    return u.convert(v);
  };
}

// Register HTTP status lookups
for (const [code, label] of Object.entries(HTTP_STATUS)) {
  EXECUTORS[`ref-http-${code}`] = () => `HTTP ${code}: ${label}`;
}

// Register country lookups
for (const [code, name] of Object.entries(COUNTRIES)) {
  EXECUTORS[`ref-country-${code.toLowerCase()}`] = () => `${code}: ${name}`;
}

// Register currency lookups
for (const [code, name] of Object.entries(CURRENCIES)) {
  EXECUTORS[`ref-currency-${code.toLowerCase()}`] = () => `${code}: ${name}`;
}

// Register MIME lookups
for (const [ext, mime] of Object.entries(MIME_EXT)) {
  EXECUTORS[`ref-mime-${ext}`] = () => `.${ext} → ${mime}`;
}

// Register git command refs
for (const [cmd, desc] of Object.entries(GIT_COMMANDS)) {
  const id = `ref-git-${slugify(cmd).slice(0, 40)}`;
  EXECUTORS[id] = () => `${cmd}\n→ ${desc}`;
}

// Register docker refs
for (const [cmd, desc] of Object.entries(DOCKER_COMMANDS)) {
  EXECUTORS[`ref-docker-${slugify(cmd).slice(0, 30)}`] = () => `${cmd}\n→ ${desc}`;
}

// Register linux refs
for (const [cmd, desc] of Object.entries(LINUX_COMMANDS)) {
  EXECUTORS[`ref-linux-${cmd}`] = () => `${cmd}\n→ ${desc}`;
}

// Register SQL refs
for (const [kw, desc] of Object.entries(SQL_KEYWORDS)) {
  EXECUTORS[`ref-sql-${kw.toLowerCase()}`] = () => `${kw}\n→ ${desc}`;
}

// Register emoji
for (const [kw, em] of Object.entries(EMOJI_MAP)) {
  EXECUTORS[`ref-emoji-${kw}`] = () => `${kw} → ${em}`;
}

// Register regex presets
for (const [name, pattern] of Object.entries(REGEX_PRESETS)) {
  EXECUTORS[`ref-regex-${name}`] = (i) => {
    try {
      const re = new RegExp(pattern);
      return `Pattern: ${pattern}\nTest "${i}": ${re.test(i) ? '✓ MATCH' : '✗ no match'}`;
    } catch {
      return `Pattern: ${pattern}`;
    }
  };
}

export function runToolExecutor(
  id: string,
  input: string,
  input2: string,
  extras: Record<string, string>
): string | Promise<string> {
  const fn = EXECUTORS[id];
  if (!fn) return `Tool "${id}" not found in registry.`;
  return fn(input, input2, extras);
}

export function hasExecutor(id: string) {
  return id in EXECUTORS;
}

export function getExecutorCount() {
  return Object.keys(EXECUTORS).length;
}