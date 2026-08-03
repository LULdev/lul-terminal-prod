/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { buildArcadeWinsLeaderboards } from './arcadeMeta.mjs';
import { sanitizeAvatarUrl } from './auth/safeMediaUrl.mjs';
import { loadUsersDb, saveUsersDb } from './auth/authStore.mjs';
import { normalizeProfileCustomization } from './profileCustomization.mjs';
import { ensureActivity, tryGrantAchievement, userAchievementIds } from './auth/achievements.mjs';
import { loadAccountsDb } from './premiumAccountsStore.mjs';
import { notifyBotLeaderboardAwards } from './chatBot.mjs';
import { readLastSync, writeLastSync, SYNC_INTERVAL_MS } from './leaderboardStore.mjs';

export const LEADERBOARD_DEFS = [
  {
    id: 'profile_views',
    awardId: 'lb_top_profile_views',
    title: 'Profile Views',
    icon: '👁️',
    unit: 'views',
    accent: 'cyan',
    getValue: (u) => Number(u.profileViews) || 0,
    min: 1,
  },
  {
    id: 'referrals',
    awardId: 'lb_top_referrals',
    title: 'Referrals',
    icon: '🎁',
    unit: 'referrals',
    accent: 'violet',
    getValue: (u) => Number(u.referralsCount) || 0,
    min: 1,
  },
  {
    id: 'uploader',
    awardId: 'lb_top_uploader',
    title: 'Image Uploader',
    icon: '☁️',
    unit: 'uploads',
    accent: 'sky',
    getValue: (u) => Number(u.imagesUploaded) || 0,
    min: 1,
  },
  {
    id: 'paste_creator',
    awardId: 'lb_top_paste_creator',
    title: 'Paste Creator',
    icon: '📋',
    unit: 'pastes',
    accent: 'emerald',
    getValue: (u) => Number(u.pastesCreated) || 0,
    min: 1,
  },
  {
    id: 'paste_views',
    awardId: 'lb_top_paste_views',
    title: 'Paste Views',
    icon: '👁️',
    unit: 'views',
    accent: 'orange',
    getValue: (u) => Number(u.pasteViewsTotal) || 0,
    min: 5,
  },
  {
    id: 'meme_creator',
    awardId: 'lb_top_meme_creator',
    title: 'Meme Creator',
    icon: '🖼️',
    unit: 'memes',
    accent: 'rose',
    getValue: (u) => Number(u.memesCreated) || 0,
    min: 1,
  },
  {
    id: 'online_minutes',
    awardId: 'lb_top_online',
    title: 'Online Time',
    icon: '⏱️',
    unit: 'minutes',
    accent: 'emerald',
    getValue: (u) => Number(u.onlineMinutes) || 0,
    min: 10,
  },
  {
    id: 'commands',
    awardId: 'lb_top_commands',
    title: 'Terminal Commands',
    icon: '⌨️',
    unit: 'commands',
    accent: 'orange',
    getValue: (u) => ensureActivity(u).commandsRun ?? 0,
    min: 5,
  },
  {
    id: 'achievements',
    awardId: 'lb_top_achievements',
    title: 'Achievement Hunter',
    icon: '🏆',
    unit: 'achievements',
    accent: 'amber',
    getValue: (u) => userAchievementIds(u.achievements).length,
    min: 3,
  },
  {
    id: 'shoutbox',
    awardId: 'lb_top_shoutbox',
    title: 'Shoutbox',
    icon: '📣',
    unit: 'messages',
    accent: 'teal',
    getValue: (u) => ensureActivity(u).shoutboxSent ?? 0,
    min: 5,
  },
  {
    id: 'page_visits',
    awardId: 'lb_top_explorer',
    title: 'Page Explorer',
    icon: '🧭',
    unit: 'visits',
    accent: 'indigo',
    getValue: (u) => ensureActivity(u).pageVisits ?? 0,
    min: 10,
  },
  {
    id: 'vault',
    awardId: 'lb_top_vault',
    title: 'Vault Submitter',
    icon: '💎',
    unit: 'accounts',
    accent: 'violet',
    getValue: (u, ctx) => ctx.vaultByUser.get(u.id) ?? 0,
    min: 1,
  },
  ...buildArcadeWinsLeaderboards(),
  {
    id: 'game_rps_losses',
    awardId: 'lb_top_game_losses',
    title: 'RPS Glutton for Punishment',
    icon: '💀',
    unit: 'losses',
    accent: 'orange',
    getValue: (u) => Number(u.gameRpsLosses) || 0,
    min: 1,
  },
  {
    id: 'game_rps_games',
    awardId: 'lb_top_game_games',
    title: 'Arcade Addict',
    icon: '🎮',
    unit: 'games',
    accent: 'indigo',
    getValue: (u) => Number(u.gameRpsGames) || 0,
    min: 1,
  },
  {
    id: 'game_ttt_losses',
    awardId: 'lb_top_ttt_losses',
    title: 'TTT Glutton',
    icon: '💀',
    unit: 'losses',
    accent: 'orange',
    getValue: (u) => Number(u.gameTttLosses) || 0,
    min: 1,
  },
  {
    id: 'game_ttt_games',
    awardId: 'lb_top_ttt_games',
    title: 'Grid Grinder',
    icon: '🔲',
    unit: 'games',
    accent: 'cyan',
    getValue: (u) => Number(u.gameTttGames) || 0,
    min: 1,
  },
  {
    id: 'lul_coins',
    awardId: 'lb_top_lul_coins',
    title: 'LULcoin Tycoon',
    icon: '🪙',
    unit: 'coins',
    accent: 'amber',
    getValue: (u) => Number(u.lulCoins) || 0,
    min: 100,
  },
];

function buildTop3(users, def, ctx = {}) {
  let pool = users.filter((u) => u.role !== 'bot' && u.active !== false);
  if (def.id === 'lul_coins') {
    pool = pool.filter((u) => {
      const privacy = normalizeProfileCustomization(u.profileCustomization).privacy;
      return privacy.showCoins !== false;
    });
  } else {
    pool = pool.filter((u) => {
      const privacy = normalizeProfileCustomization(u.profileCustomization).privacy;
      return privacy.showActivityStats !== false;
    });
  }
  const rows = pool
    .map((u) => ({
      userId: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: sanitizeAvatarUrl(u.avatarUrl) || '',
      role: u.role,
      verified: Boolean(u.verified),
      value: def.getValue(u, ctx),
    }))
    .filter((r) => r.value >= (def.min ?? 1))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  return {
    id: def.id,
    awardId: def.awardId,
    title: def.title,
    icon: def.icon,
    unit: def.unit,
    accent: def.accent,
    top3: rows,
  };
}

async function vaultCountByUser() {
  const db = await loadAccountsDb();
  const map = new Map();
  for (const a of db.accounts) {
    const uid = a.createdByUserId;
    if (!uid) continue;
    map.set(uid, (map.get(uid) ?? 0) + 1);
  }
  return map;
}

export async function buildLeaderboards() {
  const [usersDb, vaultByUser] = await Promise.all([
    loadUsersDb(),
    vaultCountByUser(),
  ]);
  const users = usersDb.users;
  const ctx = { vaultByUser };

  const boards = LEADERBOARD_DEFS.map((def) => buildTop3(users, def, ctx));
  return {
    generatedAt: Date.now(),
    boards,
  };
}

export async function syncLeaderboardAwards(force = false) {
  const last = await readLastSync();
  if (!force && Date.now() - last < SYNC_INTERVAL_MS) {
    return { synced: false, grants: [] };
  }

  const { runCoinTransaction } = await import('./gamesCoinLock.mjs');
  return runCoinTransaction(async () => {
  const db = await loadUsersDb();
  const vaultByUser = await vaultCountByUser();
  const ctx = { vaultByUser };
  const grants = [];

  for (const def of LEADERBOARD_DEFS) {
    const top3 = buildTop3(db.users, def, ctx).top3;
    for (const entry of top3) {
      const user = db.users.find((u) => u.id === entry.userId);
      if (!user || user.role === 'bot') continue;
      if (tryGrantAchievement(user, def.awardId)) {
        grants.push({
          username: user.username,
          awardId: def.awardId,
          boardId: def.id,
          boardTitle: def.title,
          rank: entry.rank,
        });
      }
    }
  }

  if (grants.length) {
    db.updatedAt = Date.now();
    await saveUsersDb(db);
    for (const g of grants) {
      notifyBotLeaderboardAwards(g).catch(() => {});
    }
  }

  await writeLastSync();
  return { synced: true, grants };
  });
}

export async function getLeaderboardsWithSync() {
  const data = await buildLeaderboards();
  const lastSyncAt = await readLastSync();
  return {
    generatedAt: data.generatedAt,
    boards: data.boards,
    lastAwardSync: { synced: false, lastSyncAt },
  };
}

let leaderboardSchedulerStarted = false;

export function startLeaderboardSyncScheduler() {
  if (leaderboardSchedulerStarted) return;
  leaderboardSchedulerStarted = true;
  const tick = () => {
    syncLeaderboardAwards(false).catch((e) => {
      console.warn('[leaderboards] background sync failed', e);
    });
  };
  tick();
  setInterval(tick, SYNC_INTERVAL_MS);
}