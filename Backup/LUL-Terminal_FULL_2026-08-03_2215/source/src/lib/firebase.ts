/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref } from 'firebase/database';


const firebaseConfig = {
  apiKey: 'AIzaSyANanuCBjnRAYo_zBn5r4WIvskgRH7YFIc',
  authDomain: 'luul-e1eeb.firebaseapp.com',
  databaseURL: 'https://luul-e1eeb-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'luul-e1eeb',
  storageBucket: 'luul-e1eeb.firebasestorage.app',
  messagingSenderId: '1072039963309',
  appId: '1:1072039963309:web:6800ead460f53893cd3424',
};

export const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getDatabase(firebaseApp);
export const hitsRef = ref(db, 'stats/hits');
export const uniqueRef = ref(db, 'stats/uniqueVisitors');
export const onlineRef = ref(db, 'stats/onlineUsers');
export const caughtCountRef = ref(db, 'stats/caughtCount');
export const memesCreatedRef = ref(db, 'stats/memesCreated');