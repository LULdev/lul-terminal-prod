/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  joinConnect4Queue,
  leaveConnect4Queue,
  releaseConnect4UserSession,
  submitConnect4Move,
  getConnect4Match,
  getConnect4UserSlice,
  getConnect4Leaderboard,
  sweepConnect4Expired,
} from './connect4Service.mjs';
import { INSTANT_GAMES } from './instantGames.mjs';
import {
  joinNimQueue,
  leaveNimQueue,
  releaseNimUserSession,
  submitNimMove,
  getNimMatch,
  getNimUserSlice,
  getNimLeaderboard,
  sweepNimExpired,
} from './nimService.mjs';
import {
  joinQueue as joinRpsQueue,
  leaveRpsQueue,
  releaseRpsUserSession,
  submitMove as submitRpsMove,
  getMatch as getRpsMatch,
  getRpsUserSlice,
  getRpsLeaderboard,
  sweepRpsExpired,
} from './rpsService.mjs';
import {
  joinTttQueue,
  leaveTttQueue,
  releaseTttUserSession,
  submitTttMove,
  getTttMatch,
  getTttUserSlice,
  getTttLeaderboard,
  sweepTttExpired,
} from './tttService.mjs';

const CUSTOM_GAMES = {
  rps: {
    id: 'rps',
    joinQueue: joinRpsQueue,
    leaveQueue: leaveRpsQueue,
    releaseUserSession: releaseRpsUserSession,
    submitMove: (userId, matchId, move) => submitRpsMove(userId, matchId, move),
    getMatch: getRpsMatch,
    getUserSlice: getRpsUserSlice,
    getLeaderboard: getRpsLeaderboard,
    sweepExpired: sweepRpsExpired,
  },
  ttt: {
    id: 'ttt',
    joinQueue: joinTttQueue,
    leaveQueue: leaveTttQueue,
    releaseUserSession: releaseTttUserSession,
    submitMove: (userId, matchId, move) => submitTttMove(userId, matchId, move),
    getMatch: getTttMatch,
    getUserSlice: getTttUserSlice,
    getLeaderboard: getTttLeaderboard,
    sweepExpired: sweepTttExpired,
  },
  nim: {
    id: 'nim',
    joinQueue: joinNimQueue,
    leaveQueue: leaveNimQueue,
    releaseUserSession: releaseNimUserSession,
    submitMove: (userId, matchId, move) => submitNimMove(userId, matchId, move),
    getMatch: getNimMatch,
    getUserSlice: getNimUserSlice,
    getLeaderboard: getNimLeaderboard,
    sweepExpired: sweepNimExpired,
  },
  connect4: {
    id: 'connect4',
    joinQueue: joinConnect4Queue,
    leaveQueue: leaveConnect4Queue,
    releaseUserSession: releaseConnect4UserSession,
    submitMove: (userId, matchId, move) => submitConnect4Move(userId, matchId, move),
    getMatch: getConnect4Match,
    getUserSlice: getConnect4UserSlice,
    getLeaderboard: getConnect4Leaderboard,
    sweepExpired: sweepConnect4Expired,
  },
};

const INSTANT_ENTRIES = Object.fromEntries(
  Object.entries(INSTANT_GAMES).map(([id, svc]) => [
    id,
    {
      id,
      joinQueue: svc.joinQueue,
      leaveQueue: svc.leaveQueue,
      releaseUserSession: svc.releaseUserSession,
      submitMove: svc.submitMove,
      getMatch: svc.getMatch,
      getUserSlice: svc.getUserSlice,
      getLeaderboard: svc.getLeaderboard,
      sweepExpired: svc.sweepExpired,
    },
  ]),
);

export const GAME_REGISTRY = {
  ...CUSTOM_GAMES,
  ...INSTANT_ENTRIES,
};

export const GAME_IDS = Object.keys(GAME_REGISTRY);

export function getGameHandler(gameId) {
  return GAME_REGISTRY[String(gameId ?? '').toLowerCase()] ?? null;
}