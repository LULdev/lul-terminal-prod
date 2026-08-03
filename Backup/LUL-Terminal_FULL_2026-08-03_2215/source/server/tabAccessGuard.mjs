/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { attachAuth } from './auth/authApi.mjs';
import { assertCanChat } from './chatGuards.mjs';
import { canAccessAdmin, isEffectivelyActive } from './auth/permissions.mjs';
import { isTabPublic, loadAccessControl } from './accessControlStore.mjs';

/** Shoutbox write + authenticated read require login and assertCanChat. Guest read is open in chatApi. */
export async function requireChatAccess(req) {
  await attachAuth(req);
  const user = req.auth?.user;
  if (!user || !isEffectivelyActive(user)) {
    throw new Error('Permission denied');
  }
  assertCanChat(user);
  await requireMemberTab(req, 'fun');
}

/** Require login when access-control marks a tab as members-only. */
export async function requireMemberTab(req, tabId) {
  const safeTab = String(tabId ?? '').slice(0, 24);
  if (safeTab === 'admin') {
    await attachAuth(req);
    const user = req.auth?.user;
    if (!user || !isEffectivelyActive(user) || !canAccessAdmin(user)) {
      throw new Error('Permission denied');
    }
    return;
  }
  const ac = await loadAccessControl();
  if (isTabPublic(ac.pages, safeTab)) return;
  await attachAuth(req);
  const user = req.auth?.user;
  if (!user || !isEffectivelyActive(user)) {
    throw new Error('Permission denied');
  }
}