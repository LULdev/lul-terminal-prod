/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { invalidateSession } from './sessionEvents';

export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}

export type SessionFetchOptions = {
  /** Read-only endpoints: 401 does not invalidate the global session. */
  soft401?: boolean;
};

/** Credentialed fetch that broadcasts 401 to the global session bus. */
export async function sessionFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts?: SessionFetchOptions,
): Promise<Response> {
  const headers = new Headers(init?.headers ?? {});
  const hasBody = init?.body != null && init.body !== '';
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  if (hasBody && !isFormData && typeof init?.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(input, {
    credentials: 'include',
    ...init,
    headers,
  });
  if (res.status === 401) {
    if (opts?.soft401) return res;
    invalidateSession();
    throw new SessionExpiredError();
  }
  return res;
}

export async function sessionJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await sessionFetch(input, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return data as T;
}