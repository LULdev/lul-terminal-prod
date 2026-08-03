/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { sessionFetch } from './sessionFetch';

const API = '/api/chat/activity';

export type MemeCreatedPayload = {
  memeName: string;
  memeImageId?: string;
  templateId?: string;
};

export async function notifyMemeCreated(payload: MemeCreatedPayload): Promise<void> {
  // soft401: best-effort achievement notify must not global-logout after meme save
  const res = await sessionFetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'meme_created',
      memeName: payload.memeName,
      memeImageId: payload.memeImageId,
      templateId: payload.templateId,
    }),
  }, { soft401: true });
  if (res.status === 401) return; // non-fatal
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Activity notify failed');
  }
}