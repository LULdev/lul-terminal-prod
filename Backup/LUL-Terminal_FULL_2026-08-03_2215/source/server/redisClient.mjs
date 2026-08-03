/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared Redis client for rate limits and guest view dedup.
 */

let redisClient = null;
let redisInit = null;

export function redisConfigured() {
  return Boolean(process.env.REDIS_URL);
}

/** @returns {Promise<import('redis').RedisClientType | null>} */
export async function getSharedRedisClient() {
  if (!process.env.REDIS_URL) return null;
  if (redisClient?.isOpen) return redisClient;
  if (!redisInit) {
    redisInit = (async () => {
      try {
        const { createClient } = await import('redis');
        const client = createClient({ url: process.env.REDIS_URL });
        client.on('error', (err) => console.error('[redis] client error', err));
        await client.connect();
        redisClient = client;
        console.info('[redis] shared client connected');
        return client;
      } catch (err) {
        console.error('[redis] unavailable', err);
        redisInit = null;
        return null;
      }
    })();
  }
  return redisInit;
}