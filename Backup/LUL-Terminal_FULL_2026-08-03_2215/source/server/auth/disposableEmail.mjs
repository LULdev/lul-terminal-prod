/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'tempmail.com',
  'temp-mail.org',
  '10minutemail.com',
  'yopmail.com',
  'throwaway.email',
  'getnada.com',
  'sharklasers.com',
  'trashmail.com',
  'fakeinbox.com',
  'maildrop.cc',
  'dispostable.com',
  'mintemail.com',
  'emailondeck.com',
]);

export function isDisposableEmail(email) {
  const domain = String(email ?? '').trim().toLowerCase().split('@')[1];
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}