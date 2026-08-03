/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { loadSessionsDb, saveSessionsDb, withSessionsWrite } from './auth/authStore.mjs';

export const MIN_DWELL_MS = 2000;
export const PROFILE_VIEW_BURST_CAP = 5;

/** Whether a tab_visit may trigger achievement side effects (blocks spoofed tab bursts). */
export function canCreditTabVisit(session, tab, { forceRemint = false } = {}) {
  if (!session || !tab) return false;
  const last = session.analyticsLastTab ?? null;
  if (last === null) return true;
  if (tab === last) return true;
  if (forceRemint) return false;
  return Boolean(session.analyticsDwellReady);
}

export async function markTabDwellIntegrity(token, tab) {
  if (!token || !tab) return;
  await withSessionsWrite(async () => {
    const db = await loadSessionsDb();
    const session = db.sessions.find((s) => s.token === token);
    if (!session || session.expiresAt <= Date.now()) return;
    const last = session.analyticsLastTab ?? null;
    if (last === null || tab !== last) return;
    const lastVisitAt = Number(session.analyticsLastVisitAt) || 0;
    if (lastVisitAt > 0 && Date.now() - lastVisitAt < MIN_DWELL_MS) return;
    session.analyticsDwellReady = true;
    await saveSessionsDb(db);
  });
}

/**
 * Atomically check dwell chain and commit tab visit (prevents parallel tab_visit farm).
 * Returns { claimed, snapshot } for rollback on achievement side-effect failure.
 */
export async function tryClaimTabVisitCredit(token, tab, { forceRemint = false } = {}) {
  if (!token || !tab) return { claimed: false, snapshot: null };
  return withSessionsWrite(async () => {
    const db = await loadSessionsDb();
    const session = db.sessions.find((s) => s.token === token);
    if (!session || session.expiresAt <= Date.now()) return { claimed: false, snapshot: null };

    const last = session.analyticsLastTab ?? null;
    let canCredit = false;
    if (last === null) canCredit = true;
    else if (tab === last) canCredit = true;
    else if (!forceRemint && session.analyticsDwellReady) canCredit = true;

    if (!canCredit) return { claimed: false, snapshot: null };

    const snapshot = {
      analyticsLastTab: session.analyticsLastTab ?? null,
      analyticsDwellReady: Boolean(session.analyticsDwellReady),
      analyticsLastVisitAt: session.analyticsLastVisitAt ?? null,
      profileViewCreditsUsed: Number(session.profileViewCreditsUsed) || 0,
    };

    if (snapshot.analyticsLastTab === 'profile' && tab !== 'profile') {
      session.profileViewCreditsUsed = 0;
    }
    if (tab === 'profile' && snapshot.analyticsLastTab !== 'profile') {
      session.profileViewCreditsUsed = 0;
    }

    session.analyticsLastTab = tab;
    session.analyticsDwellReady = false;
    session.analyticsLastVisitAt = Date.now();
    await saveSessionsDb(db);
    return { claimed: true, snapshot };
  });
}

/** Cap unique profile-view achievement credits per profile-tab stint. */
export async function tryClaimProfileViewCredit(token) {
  if (!token) return false;
  return withSessionsWrite(async () => {
    const db = await loadSessionsDb();
    const session = db.sessions.find((s) => s.token === token);
    if (!session || session.expiresAt <= Date.now()) return false;
    if (String(session.analyticsLastTab ?? '') !== 'profile') return false;
    const lastVisitAt = Number(session.analyticsLastVisitAt) || 0;
    if (lastVisitAt > 0 && Date.now() - lastVisitAt < MIN_DWELL_MS) return false;
    const used = Number(session.profileViewCreditsUsed) || 0;
    if (used >= PROFILE_VIEW_BURST_CAP) return false;
    session.profileViewCreditsUsed = used + 1;
    await saveSessionsDb(db);
    return true;
  });
}

export async function rollbackTabVisitCredit(token, snapshot) {
  if (!token || !snapshot) return;
  await withSessionsWrite(async () => {
    const db = await loadSessionsDb();
    const session = db.sessions.find((s) => s.token === token);
    if (!session || session.expiresAt <= Date.now()) return;
    session.analyticsLastTab = snapshot.analyticsLastTab;
    session.analyticsDwellReady = snapshot.analyticsDwellReady;
    session.analyticsLastVisitAt = snapshot.analyticsLastVisitAt;
    if (snapshot.profileViewCreditsUsed != null) {
      session.profileViewCreditsUsed = snapshot.profileViewCreditsUsed;
    }
    await saveSessionsDb(db);
  });
}

/** Undo a burst slot when user-DB credit fails after tryClaimProfileViewCredit. */
export async function releaseProfileViewCredit(token) {
  if (!token) return;
  await withSessionsWrite(async () => {
    const db = await loadSessionsDb();
    const session = db.sessions.find((s) => s.token === token);
    if (!session || session.expiresAt <= Date.now()) return;
    const used = Number(session.profileViewCreditsUsed) || 0;
    if (used > 0) session.profileViewCreditsUsed = used - 1;
    await saveSessionsDb(db);
  });
}