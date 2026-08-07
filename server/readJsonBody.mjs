/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Read and parse a JSON request body with size limit.
 * Throws Error with statusCode 413 (payload) or 400 (invalid JSON).
 * Empty body → {}.
 *
 * @param {import('http').IncomingMessage} req
 * @param {number} [limit=65536]
 */
export async function readJsonBody(req, limit = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      const err = new Error('Payload too large');
      err.statusCode = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const err = new Error('Invalid JSON');
    err.statusCode = 400;
    throw err;
  }
}
