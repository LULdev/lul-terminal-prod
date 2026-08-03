/**
 * Enable tracked git hooks (auto-push after commit).
 * Usage: node scripts/install-git-hooks.mjs
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hooksPath = 'scripts/git-hooks';

try {
  execSync(`git config core.hooksPath ${hooksPath}`, { cwd: root, stdio: 'inherit' });
  console.log(`[hooks] core.hooksPath → ${hooksPath}`);
  console.log('[hooks] post-commit will auto-push the current branch after every commit');
} catch (err) {
  console.error('[hooks] failed to set core.hooksPath', err);
  process.exit(1);
}
