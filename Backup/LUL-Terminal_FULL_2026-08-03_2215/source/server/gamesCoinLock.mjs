/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { withUsersWrite } from './auth/authStore.mjs';

/** Serialize coin + user mutations on the same users.json write chain. */
export async function runCoinTransaction(fn) {
  return withUsersWrite(fn);
}