/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { onValue, runTransaction } from 'firebase/database';
import { caughtCountRef } from '../lib/firebase';

export function useFirebaseCaughtCount() {
  const [caughtCount, setCaughtCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const unsub = onValue(caughtCountRef, (snap) => {
      if (!alive) return;
      setCaughtCount(snap.val() ?? 0);
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const recordCatch = useCallback(() => {
    runTransaction(caughtCountRef, (current) => (current ?? 0) + 1);
  }, []);

  return { caughtCount, recordCatch };
}