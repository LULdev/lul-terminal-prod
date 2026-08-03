import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, runTransaction } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyANanuCBjnRAYo_zBn5r4WIvskgRH7YFIc',
  authDomain: 'luul-e1eeb.firebaseapp.com',
  databaseURL: 'https://luul-e1eeb-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'luul-e1eeb',
  storageBucket: 'luul-e1eeb.firebasestorage.app',
  messagingSenderId: '1072039963309',
  appId: '1:1072039963309:web:6800ead460f53893cd3424',
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const paths = ['stats/hits', 'stats/uniqueVisitors', 'stats/onlineUsers', 'stats/caughtCount', 'stats/memesCreated'];

async function readStats() {
  const result = {};
  for (const path of paths) {
    const snap = await get(ref(db, path));
    result[path] = snap.val();
  }
  return result;
}

async function testWrite() {
  const testRef = ref(db, 'stats/_connectivityTest');
  const tx = await runTransaction(testRef, (current) => (current ?? 0) + 1);
  return { committed: tx.committed, newValue: tx.snapshot.val() };
}

try {
  console.log('=== Firebase RTDB connectivity test ===');
  const stats = await readStats();
  console.log('READ stats:', JSON.stringify(stats, null, 2));

  const write = await testWrite();
  console.log('WRITE test (stats/_connectivityTest):', JSON.stringify(write, null, 2));

  if (Object.values(stats).every((v) => v === null)) {
    console.log('\nNOTE: All stat values are null — paths exist but may be uninitialized.');
  }
  console.log('\nRESULT: Connection OK');
  process.exit(0);
} catch (err) {
  console.error('\nRESULT: FAILED');
  console.error(err?.code ?? err?.name ?? 'Error', err?.message ?? String(err));
  if (String(err?.message).includes('PERMISSION_DENIED')) {
    console.error('\nFix: In Firebase Console → Realtime Database → Rules, allow stats:');
    console.error(JSON.stringify({ rules: { stats: { '.read': true, '.write': true } } }, null, 2));
  }
  process.exit(1);
}