/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GAME_CATALOG, type GameId } from './gameCatalog';
import { leaveGameQueue, type GamesState } from './games';

function getGameSlice(state: GamesState | null, gameId: string) {
  return state?.games?.[gameId] ?? state?.[gameId as 'rps' | 'ttt'];
}

let lastState: GamesState | null = null;
let lastWaiting = false;
let lastSelectedGame: GameId = 'rps';

export function registerArcadeSnapshot(
  state: GamesState | null,
  opts?: { waiting?: boolean; selectedGame?: GameId },
) {
  if (state) lastState = state;
  if (opts?.waiting != null) lastWaiting = opts.waiting;
  if (opts?.selectedGame) lastSelectedGame = opts.selectedGame;
}

/** Best-effort queue leave before session cookie is cleared (passive 401 / invalidation). */
export async function leaveAllArcadeQueuesBestEffort(): Promise<void> {
  // Always attempt every game — server no-ops when not queued; snapshot can be stale
  // (missed multi-game queues if we only leave slices marked inQueue).
  const ids = new Set<GameId>(GAME_CATALOG.map((g) => g.id));
  if (lastWaiting) ids.add(lastSelectedGame);
  if (lastState) {
    for (const g of GAME_CATALOG) {
      const slice = getGameSlice(lastState, g.id);
      if (slice?.inQueue) ids.add(g.id as GameId);
    }
  }
  await Promise.all(
    [...ids].map((id) => leaveGameQueue(id).catch(() => { /* best-effort */ })),
  );
}