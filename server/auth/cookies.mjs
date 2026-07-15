/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const SESSION_COOKIE = 'lul_session';
/** HttpOnly marker set after successful registration — blocks re-register from same browser. */
export const REG_LOCK_COOKIE = 'lul_reg_lock';
/** Readable companion cookie — survives some privacy modes differently than HttpOnly. */
export const REG_HINT_COOKIE = 'lul_reg_hint';
export const REG_LOCK_MAX_AGE_SEC = 60 * 60 * 24 * 365 * 10;
export const SESSION_SHORT_SEC = 60 * 60 * 24;
export const SESSION_REMEMBER_SEC = 60 * 60 * 24 * 30;

export function parseCookies(req) {
  const header = req.headers.cookie ?? '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

function useSecureCookies() {
  if (process.env.COOKIE_SECURE === '0' || process.env.COOKIE_SECURE === 'false') return false;
  if (process.env.COOKIE_SECURE === '1' || process.env.COOKIE_SECURE === 'true') return true;
  const base = String(process.env.PUBLIC_BASE_URL ?? '').trim().toLowerCase();
  if (base.startsWith('https://')) return true;
  return false;
}

function cookieBaseParts() {
  const parts = ['Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (useSecureCookies()) parts.push('Secure');
  return parts;
}

export function setSessionCookie(res, token, maxAgeSec) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    ...cookieBaseParts(),
    `Max-Age=${maxAgeSec}`,
  ];
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', [`${SESSION_COOKIE}=`, ...cookieBaseParts(), 'Max-Age=0'].join('; '));
}

export function setRegistrationLockCookie(res, token) {
  if (!token) return;
  const encoded = encodeURIComponent(String(token).slice(0, 64));
  const lock = [
    `${REG_LOCK_COOKIE}=${encoded}`,
    ...cookieBaseParts(),
    `Max-Age=${REG_LOCK_MAX_AGE_SEC}`,
  ].join('; ');
  const hintParts = ['Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${REG_LOCK_MAX_AGE_SEC}`];
  if (useSecureCookies()) hintParts.push('Secure');
  const hint = [`${REG_HINT_COOKIE}=${encoded}`, ...hintParts].join('; ');
  res.setHeader('Set-Cookie', [lock, hint]);
}