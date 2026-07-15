/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SocialLink } from '../data/achievements';
import type { AuthPermissions, AuthUser, PublicProfile, UserRole } from '../types/auth';
import type { ProfileCustomization } from '../types/profileCustomization';

export type AuthUnlockResponse = {
  user: AuthUser;
  newUnlocks?: string[];
  unlockRewards?: Record<string, number>;
  unlockCoinsTotal?: number;
  permissions?: AuthPermissions;
  stats?: { accountsSubmitted: number };
};

import { invalidateSession } from './sessionEvents';
import { validateImageFileMagic } from './imageMime';
import { parseRetryAfterMs } from './retryAfter';

const AVATAR_ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const API = '/api/auth';

type ApiOpts = { soft401?: boolean };

async function api<T>(path: string, init?: RequestInit, opts?: ApiOpts): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !opts?.soft401) invalidateSession();
    if (res.status === 429) {
      const waitSec = Math.ceil(parseRetryAfterMs(res.headers.get('Retry-After'), 60_000) / 1000);
      const err = new Error(
        (data as { error?: string }).error ?? `Too many attempts — try again in ${waitSec}s`,
      ) as Error & { status?: number; retryAfterMs?: number };
      err.status = 429;
      err.retryAfterMs = waitSec * 1000;
      throw err;
    }
    const err = new Error((data as { error?: string }).error ?? `HTTP ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export async function fetchMe(): Promise<{
  user: AuthUser | null;
  permissions: AuthPermissions;
  stats: { accountsSubmitted: number } | null;
}> {
  return api('/me', undefined, { soft401: true });
}

export async function fetchPublicProfile(username: string): Promise<PublicProfile> {
  const uname = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const res = await fetch(`${API}/users/${encodeURIComponent(uname)}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data.user as PublicProfile;
}

const PROFILE_VIEW_PREFIX = 'lul_profile_view_';
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
/** Mirrors server analyticsTabIntegrity MIN_DWELL_MS + buffer */
const PROFILE_VIEW_DWELL_MS = 2100;
const profileViewInflight = new Map<string, Promise<ProfileViewResult>>();

async function waitForProfileDwell() {
  const deadline = Date.now() + PROFILE_VIEW_DWELL_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, Math.min(400, deadline - Date.now())));
  }
}

export type ProfileViewResult = {
  user: PublicProfile;
  credited: boolean;
};

export async function recordProfileView(
  username: string,
  opts: { skipDwell?: boolean } = {},
): Promise<ProfileViewResult> {
  const uname = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const pending = profileViewInflight.get(uname);
  if (pending) return pending;

  const canUseSession = typeof sessionStorage !== 'undefined';
  const run = (async (): Promise<ProfileViewResult> => {
    const sessionKey = `${PROFILE_VIEW_PREFIX}${uname}`;
    if (!canUseSession || !sessionStorage.getItem(sessionKey)) {
      if (!opts.skipDwell) await waitForProfileDwell();
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const res = await fetch(`${API}/users/${encodeURIComponent(uname)}/view`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });
          if (res.status === 401) {
            return { user: await fetchPublicProfile(uname), credited: false };
          }
          if (res.status === 429) {
            const waitMs = Math.min(parseRetryAfterMs(res.headers.get('Retry-After'), 2000), 30_000);
            await new Promise((r) => setTimeout(r, waitMs));
            continue;
          }
          if (res.ok) {
            const data = await res.json() as { user: PublicProfile; credited?: boolean };
            if (canUseSession) sessionStorage.setItem(sessionKey, '1');
            return { user: data.user, credited: Boolean(data.credited) };
          }
        } catch { /* fall through */ }
        if (attempt < 4) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
        break;
      }
    }
    return { user: await fetchPublicProfile(uname), credited: false };
  })();

  profileViewInflight.set(uname, run);
  try {
    return await run;
  } finally {
    if (profileViewInflight.get(uname) === run) profileViewInflight.delete(uname);
  }
}

export async function login(email: string, password: string, remember: boolean) {
  return api<AuthUnlockResponse>('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, remember }),
  }, { soft401: true });
}

export type ReferralInfo = {
  referralCode: string;
  referralsCount: number;
  inviteUrl: string;
  user: AuthUser;
};

export async function fetchReferralInfo(): Promise<ReferralInfo> {
  return api<ReferralInfo>('/referral/me');
}

export async function register(input: {
  email: string;
  password: string;
  username?: string;
  displayName?: string;
  referralCode?: string;
  website?: string;
  registrationChallenge?: string;
  registrationContext?: Record<string, string | number>;
}) {
  return api<{ user: AuthUser }>('/register', {
    method: 'POST',
    body: JSON.stringify(input),
  }, { soft401: true });
}

export async function logout() {
  return api<{ ok: boolean }>('/logout', { method: 'POST' });
}

export async function updateProfile(input: Partial<{
  displayName: string;
  bio: string;
  website: string;
  email: string;
  password: string;
  currentPassword: string;
  avatarUrl: string;
  coverUrl: string;
  socialLinks: SocialLink[];
  profileCustomization: Partial<ProfileCustomization> & {
    status?: Partial<ProfileCustomization['status']>;
    privacy?: Partial<ProfileCustomization['privacy']>;
  };
}>) {
  return api<AuthUnlockResponse>('/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function uploadAvatar(file: File): Promise<AuthUnlockResponse> {
  if (file.size > MAX_AVATAR_BYTES) throw new Error('Avatar max. 2 MB');
  if (!AVATAR_ALLOWED_MIME.has(file.type)) {
    throw new Error('Only JPEG, PNG, GIF or WebP allowed.');
  }
  const magicErr = await validateImageFileMagic(file, AVATAR_ALLOWED_MIME);
  if (magicErr) throw new Error(magicErr);
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
  const base64 = dataUrl.split(',')[1] ?? '';
  return api<AuthUnlockResponse>('/avatar', {
    method: 'POST',
    body: JSON.stringify({ mime: file.type, data: base64 }),
  });
}

export type SyncAchievementsOpts = {
  visitedTab?: string;
};

export async function syncAchievements(opts: SyncAchievementsOpts = {}) {
  return api<AuthUnlockResponse>('/achievements/sync', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
}

export async function recordAchievementEvent(event: 'claw_victim', proof: string) {
  return api<AuthUnlockResponse>('/achievements/event', {
    method: 'POST',
    body: JSON.stringify({ event, proof }),
  });
}

export async function recordTerminalCommand(command: string, proof: string) {
  return api<AuthUnlockResponse>('/achievements/terminal-command', {
    method: 'POST',
    body: JSON.stringify({ command, proof }),
  });
}

export async function deleteAccount(password: string) {
  return api<{ ok: boolean }>('/account', {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  });
}

export async function adminListUsers(opts: { search?: string; role?: UserRole | ''; active?: string } = {}) {
  const params = new URLSearchParams();
  if (opts.search?.trim()) params.set('search', opts.search.trim());
  if (opts.role) params.set('role', opts.role);
  if (opts.active) params.set('active', opts.active);
  const q = params.toString();
  return api<{ users: AuthUser[]; total: number }>(`/admin/users${q ? `?${q}` : ''}`);
}

export async function adminCreateUser(input: Record<string, unknown>) {
  return api<{ user: AuthUser }>('/admin/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function adminUpdateUser(id: string, input: Record<string, unknown>) {
  return api<{ user: AuthUser }>(`/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function adminDeleteUser(id: string) {
  return api<{ ok: boolean }>(`/admin/users/${id}`, { method: 'DELETE' });
}