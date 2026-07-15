/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PinnedMessage } from './chat';

/** Static pinned welcome — always shown; API may refresh when signed in. */
export const PINNED_WELCOME: PinnedMessage = {
  id: 'pinned-welcome',
  kind: 'pinned',
  text: 'Welcome to LUL.bz :Welcome:',
  segments: [
    { type: 'text', text: 'Welcome to LUL.bz ' },
    {
      type: 'emote',
      code: 'Welcome',
      label: 'Welcome',
      url: '/emotes/welcome.svg',
    },
  ],
};