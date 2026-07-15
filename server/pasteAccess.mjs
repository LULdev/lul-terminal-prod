/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { attachAuth } from './auth/authApi.mjs';
import { verifyPassword } from './pasteStore.mjs';

/**
 * @param {import('http').IncomingMessage} req
 * @param {object} meta normalized paste meta
 * @param {string} [passwordFromQuery]
 * @returns {Promise<{ allowed: boolean; requiresPassword?: boolean; requiresLogin?: boolean; notFound?: boolean }>}
 */
export async function resolvePasteAccess(req, meta, passwordFromQuery = '') {
  if (meta.visibility === 'protected') {
    if (!meta.passwordHash || !verifyPassword(passwordFromQuery, meta.passwordHash)) {
      return { allowed: false, requiresPassword: true };
    }
    return { allowed: true };
  }

  if (meta.visibility === 'private') {
    await attachAuth(req);
    const user = req.auth?.user;
    if (!user) {
      return { allowed: false, notFound: true };
    }
    if (!meta.userId || String(meta.userId) !== String(user.id)) {
      return { allowed: false, notFound: true };
    }
    return { allowed: true };
  }

  return { allowed: true };
}