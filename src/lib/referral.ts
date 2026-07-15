/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const REFERRAL_STORAGE_KEY = 'lul_referral_code';

export function captureReferralFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref')?.trim();
  if (!ref) return null;
  const code = ref.toUpperCase();
  try {
    localStorage.setItem(REFERRAL_STORAGE_KEY, code);
  } catch { /* ignore */ }
  const url = new URL(window.location.href);
  url.searchParams.delete('ref');
  const next = url.pathname + (url.search || '') + url.hash;
  window.history.replaceState({}, '', next || '/');
  return code;
}

export function getStoredReferralCode(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(REFERRAL_STORAGE_KEY)?.trim().toUpperCase() ?? '';
  } catch {
    return '';
  }
}

export function clearStoredReferralCode(): void {
  try {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch { /* ignore */ }
}

export function buildClientInviteUrl(code: string): string {
  if (typeof window === 'undefined') return `/?ref=${encodeURIComponent(code)}`;
  const origin = window.location.origin;
  return `${origin}/?ref=${encodeURIComponent(code)}`;
}