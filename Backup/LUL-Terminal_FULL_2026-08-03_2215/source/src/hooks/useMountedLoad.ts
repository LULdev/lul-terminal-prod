/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';

/** Guards async panel loads against stale responses after unmount or superseded fetch. */
export function useMountedLoad() {
  const mountedRef = useRef(true);
  const loadGenRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  return { mountedRef, loadGenRef };
}