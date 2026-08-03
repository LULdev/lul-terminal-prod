/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const PREFIXES = [
  'lul_page_view_',
  'lul_post_view_',
  'lul_paste_view_',
  'lul_img_view_',
  'lul_profile_view_',
  'lul_acct_view_',
];

/** Clear per-session view dedup keys so a new login gets fresh view credit. */
export function clearViewDedupSessionKeys() {
  if (typeof sessionStorage === 'undefined') return;
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key && PREFIXES.some((p) => key.startsWith(p))) {
      sessionStorage.removeItem(key);
    }
  }
}