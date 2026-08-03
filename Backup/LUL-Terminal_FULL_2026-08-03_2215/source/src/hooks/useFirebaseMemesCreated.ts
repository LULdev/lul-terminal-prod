/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { onValue, runTransaction } from 'firebase/database';
import { memesCreatedRef } from '../lib/firebase';

export function useFirebaseMemesCreated() {
  const [memesCreated, setMemesCreated] = useState(0);

  useEffect(() => {
    return onValue(memesCreatedRef, (snap) => {
      setMemesCreated(snap.val() ?? 0);
    });
  }, []);

  const recordMemeCreated = useCallback(() => {
    runTransaction(memesCreatedRef, (current) => (current ?? 0) + 1);
  }, []);

  return { memesCreated, recordMemeCreated };
}