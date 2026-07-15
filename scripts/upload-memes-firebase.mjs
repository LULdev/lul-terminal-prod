/**
 * Optional: upload meme catalog metadata to Firebase RTDB (memes/meta + chunked indexes)
 * Run after scrape: node scripts/upload-memes-firebase.mjs
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalogPath = join(__dirname, '../public/memes/catalog.json');

const firebaseConfig = {
  apiKey: 'AIzaSyANanuCBjnRAYo_zBn5r4WIvskgRH7YFIc',
  authDomain: 'luul-e1eeb.firebaseapp.com',
  databaseURL: 'https://luul-e1eeb-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'luul-e1eeb',
  storageBucket: 'luul-e1eeb.firebasestorage.app',
  messagingSenderId: '1072039963309',
  appId: '1:1072039963309:web:6800ead460f53893cd3424',
};

const CHUNK = 200;

async function main() {
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);

  await set(ref(db, 'memes/meta'), {
    scrapedAt: catalog.scrapedAt,
    source: catalog.source,
    staticPages: catalog.staticPages ?? '2-50',
    gifPages: catalog.gifPages ?? '2-169',
    total: catalog.total,
    staticCount: catalog.staticCount,
    gifCount: catalog.gifCount,
  });

  const templates = catalog.templates;
  for (let i = 0; i < templates.length; i += CHUNK) {
    const slice = templates.slice(i, i + CHUNK);
    const chunkIndex = Math.floor(i / CHUNK);
    const payload = Object.fromEntries(slice.map((t) => [t.id, t]));
    await set(ref(db, `memes/chunks/${chunkIndex}`), payload);
    console.log(`Uploaded chunk ${chunkIndex + 1}/${Math.ceil(templates.length / CHUNK)}`);
  }

  console.log(`Done: ${templates.length} templates → Firebase memes/chunks/*`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});