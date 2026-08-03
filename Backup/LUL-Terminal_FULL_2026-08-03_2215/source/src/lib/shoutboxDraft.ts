/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

type ShoutboxDraftHandler = {
  insert: (fragment: string) => void;
  focus: () => void;
};

let handler: ShoutboxDraftHandler | null = null;

export function registerShoutboxDraft(h: ShoutboxDraftHandler | null) {
  handler = h;
}

export function insertShoutboxDraft(fragment: string) {
  handler?.insert(fragment);
}

export function focusShoutboxInput() {
  handler?.focus();
}