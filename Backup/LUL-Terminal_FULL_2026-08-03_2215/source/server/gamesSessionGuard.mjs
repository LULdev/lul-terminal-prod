/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

async function getGamesStateForUser(userId) {
  const { GAME_IDS, GAME_REGISTRY } = await import('./gameRegistry.mjs');
  const slices = await Promise.all(GAME_IDS.map((id) => GAME_REGISTRY[id].getUserSlice(userId)));
  const games = {};
  GAME_IDS.forEach((id, i) => {
    games[id] = slices[i];
  });
  return { games };
}

export async function assertNoPlayingMatchAnywhere(userId) {
  if (!userId) return;
  const state = await getGamesStateForUser(userId);
  for (const slice of Object.values(state.games)) {
    if (slice?.activeMatch?.status === 'playing') {
      throw new Error('Finish your active match first');
    }
  }
}

export async function assertNoOtherArcadeSession(userId, exceptGameId) {
  if (!userId) return;
  const state = await getGamesStateForUser(userId);
  for (const [id, slice] of Object.entries(state.games)) {
    if (id === exceptGameId) continue;
    if (slice?.activeMatch?.status === 'playing') {
      throw new Error('Finish your active match before joining another game');
    }
    if (slice?.inQueue) {
      throw new Error('Leave your other game queue before joining');
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