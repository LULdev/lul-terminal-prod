/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { onValue, runTransaction } from 'firebase/database';
import { memesCreatedRef } from '../lib/firebase';

export function useFirebaseMemesCreated() {
  const [memesCreated, setMemesCreated] = useState(0);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    const unsub = onValue(memesCreatedRef, (snap) => {
      if (!aliveRef.current) return;
      setMemesCreated(snap.val() ?? 0);
    });
    return () => {
      aliveRef.current = false;
      unsub();
    };
  }, []);

  const recordMemeCreated = useCallback(() => {
    runTransaction(memesCreatedRef, (current) => (current ?? 0) + 1).catch(() => {});
  }, []);

  return { memesCreated, recordMemeCreated };
}