/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChatEmote } from './chatEmotes';
import { sessionFetch } from './sessionFetch';

const API = '/api/admin/chat/emotes';

export type AdminChatEmote = ChatEmote & {
  mime: string;
  filename: string;
  createdAt: number;
  updatedAt: number;
};

export type AdminEmotesResponse = {
  updatedAt: string | null;
  emotes: AdminChatEmote[];
};

async function adminApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await sessionFetch(`${API}${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

export async function fetchAdminEmotes(): Promise<AdminEmotesResponse> {
  return adminApi('');
}

export async function createAdminEmote(input: {
  code: string;
  label: string;
  mime: string;
  data: string;
  enabled?: boolean;
}): Promise<{ emote: AdminChatEmote }> {
  return adminApi('', { method: 'POST', body: JSON.stringify(input) });
}

export async function updateAdminEmote(id: string, patch: {
  code?: string;
  label?: string;
  enabled?: boolean;
}): Promise<{ emote: AdminChatEmote }> {
  return adminApi(`/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function uploadAdminEmoteImage(id: string, input: {
  mime: string;
  data: string;
}): Promise<{ emote: AdminChatEmote }> {
  return adminApi(`/${id}/upload`, { method: 'POST', body: JSON.stringify(input) });
}

export async function deleteAdminEmote(id: string): Promise<{ ok: boolean }> {
  return adminApi(`/${id}`, { method: 'DELETE' });
}

export function readFileAsBase64(file: File): Promise<{ mime: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      const data = comma >= 0 ? result.slice(comma + 1) : result;
      resolve({ mime: file.type || 'image/png', data });
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}