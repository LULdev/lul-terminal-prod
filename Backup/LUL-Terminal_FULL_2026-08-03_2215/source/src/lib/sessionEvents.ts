/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

type SessionListener = () => void;

const listeners = new Set<SessionListener>();

/** Monotonic epoch — bumped on login/logout/invalidate so late 401s cannot wipe a new session. */
let sessionEpoch = 0;

export function getSessionEpoch(): number {
  return sessionEpoch;
}

/** Bump epoch (call on successful login / explicit logout). Returns new epoch. */
export function bumpSessionEpoch(): number {
  sessionEpoch += 1;
  return sessionEpoch;
}

export function onSessionInvalidated(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let invalidationPending = false;

/**
 * Broadcast session loss. If `epoch` is provided and no longer matches, ignore
 * (stale in-flight request after re-login).
 */
export function invalidateSession(opts?: { epoch?: number }): void {
  if (opts?.epoch != null && opts.epoch !== sessionEpoch) return;
  if (invalidationPending) return;
  invalidationPending = true;
  sessionEpoch += 1;
  for (const listener of listeners) listener();
}

/** Call after successful login/refresh so a later 401 can invalidate again. */
export function resetSessionInvalidation(): void {
  invalidationPending = false;
}
