/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Session asserts use durable matchmaker memory (hydrate first when safe).
 * Never call getUserSlice here — that acquires matchmaker write under users lock (deadlock).
 * Join paths should use withMatchmakersHeldForJoin so memory is fresh under held MM locks
 * while runCoinTransaction makes isInsideUsersWrite true (hydrate correctly skipped).
 */
async function ensureArcadeSessionView() {
  const { isInsideUsersWrite } = await import('./auth/authStore.mjs');
  const { hydrateAllMatchmakers } = await import('./gamesMatchmakerStore.mjs');
  // Under users write: never take matchmaker locks (deadlock). Callers must hold/hydrate MM outer.
  if (!isInsideUsersWrite()) {
    await hydrateAllMatchmakers().catch(() => {});
  }
}

export async function assertNoPlayingMatchAnywhere(userId) {
  if (!userId) return;
  await ensureArcadeSessionView();
  const { userInAnyMatchmakerSession } = await import('./gamesMatchmakerStore.mjs');
  if (userInAnyMatchmakerSession(userId)) {
    // May include queue — narrow to playing matches only
    const { listRegisteredMatchmakerGameIds, getMatchmaker } = await import('./gamesMatchmakerStore.mjs');
    for (const id of listRegisteredMatchmakerGameIds()) {
      const mm = getMatchmaker(id);
      if (!mm) continue;
      for (const m of mm.activeMatches.values()) {
        if (m.status !== 'playing') continue;
        if (m.player1?.userId === userId || m.player2?.userId === userId) {
          throw new Error('Finish your active match first');
        }
      }
    }
  }
}

export async function assertNoOtherArcadeSession(userId, exceptGameId) {
  if (!userId) return;
  await ensureArcadeSessionView();
  const { userInOtherMatchmakerSession, listRegisteredMatchmakerGameIds, getMatchmaker } =
    await import('./gamesMatchmakerStore.mjs');
  if (!userInOtherMatchmakerSession(userId, exceptGameId)) return;
  for (const id of listRegisteredMatchmakerGameIds()) {
    if (exceptGameId && id === exceptGameId) continue;
    const mm = getMatchmaker(id);
    if (!mm) continue;
    if (mm.queue.some((q) => q.userId === userId)) {
      throw new Error('Leave your other game queue before joining');
    }
    for (const m of mm.activeMatches.values()) {
      if (m.status !== 'playing') continue;
      if (m.player1?.userId === userId || m.player2?.userId === userId) {
        throw new Error('Finish your active match before joining another game');
      }
    }
  }
}

export async function assertPvpPairReady(hostId, joinerId, gameId) {
  await assertNoPlayingMatchAnywhere(hostId);
  await assertNoPlayingMatchAnywhere(joinerId);
  if (gameId) {
    await assertNoOtherArcadeSession(hostId, gameId);
    await assertNoOtherArcadeSession(joinerId, gameId);
  }
}