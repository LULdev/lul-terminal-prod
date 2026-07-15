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
  if (lastWaiting) {
    try { await leaveGameQueue(lastSelectedGame); } catch { /* best-effort */ }
  }
  if (!lastState) return;
  for (const g of GAME_CATALOG) {
    const slice = getGameSlice(lastState, g.id);
    if (slice?.inQueue) {
      try { await leaveGameQueue(g.id); } catch { /* best-effort */ }
    }
  }
}