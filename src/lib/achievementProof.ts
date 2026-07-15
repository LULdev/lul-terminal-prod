/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AchievementProof = {
  tab: string;
  nonce: string;
  exp: number;
};

/** Server stores one proof at a time — client mirrors with a single slot. */
let cached: AchievementProof | null = null;
let remintRequestCount = 0;

/** Signal App to force a tab_visit track after proof was consumed on the same tab. */
export function requestAchievementProofRemint() {
  remintRequestCount += 1;
}

export function takeAchievementProofRemintRequest(): boolean {
  if (remintRequestCount <= 0) return false;
  remintRequestCount = 0;
  return true;
}

function pruneExpired() {
  if (cached && Date.now() > cached.exp) cached = null;
}

export function setAchievementProof(proof: AchievementProof | null | undefined) {
  if (!proof?.nonce || !proof.exp || !proof.tab) {
    return;
  }
  if (Date.now() >= proof.exp) return;
  cached = proof;
}

/** Read proof nonce without consuming it. */
export function peekAchievementProof(requiredTab?: string): string | null {
  pruneExpired();
  if (!cached) return null;
  if (requiredTab && cached.tab !== requiredTab) return null;
  return cached.nonce;
}

/** Consume proof after a successful API call. */
export function commitAchievementProof(requiredTab?: string) {
  pruneExpired();
  if (!cached) return;
  if (requiredTab && cached.tab !== requiredTab) return;
  cached = null;
  requestAchievementProofRemint();
}

/** Take proof for an action; optionally require it was minted on a specific tab. */
export function takeAchievementProof(requiredTab?: string): string | null {
  const nonce = peekAchievementProof(requiredTab);
  if (!nonce) return null;
  commitAchievementProof(requiredTab);
  return nonce;
}

export function clearAchievementProofs() {
  cached = null;
  remintRequestCount = 0;
}