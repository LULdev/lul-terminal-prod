/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

type SessionListener = () => void;

const listeners = new Set<SessionListener>();

export function onSessionInvalidated(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let invalidationPending = false;

export function invalidateSession(): void {
  if (invalidationPending) return;
  invalidationPending = true;
  for (const listener of listeners) listener();
}

/** Call after successful login/refresh so a later 401 can invalidate again. */
export function resetSessionInvalidation(): void {
  invalidationPending = false;
}