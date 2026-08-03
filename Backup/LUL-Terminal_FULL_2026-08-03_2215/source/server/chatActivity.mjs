/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ensureActivity } from './auth/achievements.mjs';
import { incrementUserMemeCreated } from './auth/authService.mjs';
import { loadUsersDb, saveUsersDb } from './auth/authStore.mjs';
import { runCoinTransaction } from './gamesCoinLock.mjs';
import { getMeta } from './imageHostStore.mjs';
import { imageViewLink, postBotMemeCreated } from './chatBot.mjs';
import { assertCanChat, getActivityFlag } from './chatGuards.mjs';

const MEME_BOT_COOLDOWN_MS = 5000;

export async function handleChatActivity(user, body) {
  const type = String(body?.type ?? '').trim();
  if (!type) throw new Error('Activity type required');

  switch (type) {
    case 'meme_created': {
      const memeName = String(body.memeName ?? body.memeLabel ?? 'Meme').trim() || 'Meme';
      const memeImageId = String(body.memeImageId ?? body.imageId ?? '').trim();
      if (!memeImageId) throw new Error('Meme image id required');
      const imageMeta = await getMeta(memeImageId);
      if (!imageMeta || String(imageMeta.userId) !== String(user.id) || imageMeta.source !== 'meme') {
        throw new Error('Meme image not found');
      }

      const flagKey = `meme_announced_${memeImageId}`;
      let reserved = false;
      let prevMemeBotAt = 0;
      try {
        await runCoinTransaction(async () => {
          const db = await loadUsersDb();
          const fresh = db.users.find((u) => u.id === user.id);
          if (!fresh) throw new Error('User not found');
          assertCanChat(fresh);
          const act = ensureActivity(fresh);
          if (act.flags[flagKey]) {
            throw new Error('This meme was already announced in the shoutbox');
          }
          const now = Date.now();
          const lastBot = getActivityFlag(act, 'lastMemeBotAt');
          if (now - lastBot < MEME_BOT_COOLDOWN_MS) {
            throw new Error('Please wait before posting another meme announcement');
          }
          prevMemeBotAt = lastBot;
          act.flags[flagKey] = true;
          act.flags.lastMemeBotAt = now;
          fresh.updatedAt = now;
          await saveUsersDb(db);
          reserved = true;
        });

        const templateId = String(body.templateId ?? '').trim();
        const rawHref = String(body.memeHref ?? '').trim();
        const safeMemePath = new RegExp(`^/(?:i|hosting)/${memeImageId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
        const memeHref = safeMemePath.test(rawHref)
          ? rawHref
          : imageViewLink(memeImageId);
        const message = await postBotMemeCreated({
          username: user.username,
          memeLabel: memeName,
          memeHref,
          templateId: templateId || undefined,
        });

        await incrementUserMemeCreated(user.id, memeImageId);
        return message;
      } catch (err) {
        if (reserved) {
          await runCoinTransaction(async () => {
            const db = await loadUsersDb();
            const fresh = db.users.find((u) => u.id === user.id);
            if (!fresh) return;
            const act = ensureActivity(fresh);
            delete act.flags[flagKey];
            if (prevMemeBotAt > 0) {
              act.flags.lastMemeBotAt = prevMemeBotAt;
            } else {
              delete act.flags.lastMemeBotAt;
            }
            fresh.updatedAt = Date.now();
            await saveUsersDb(db);
          });
        }
        throw err;
      }
    }
    default:
      throw new Error(`Unknown activity type: ${type}`);
  }
}