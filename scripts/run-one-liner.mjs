/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Cross-platform dispatcher for one-liner scripts.
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const cmd = process.argv[2] || 'help';
const isWin = process.platform === 'win32';

const child = isWin
  ? spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', path.join(root, 'scripts', 'one-liners.ps1'),
      cmd,
    ], { cwd: root, stdio: 'inherit' })
  : spawn('bash', [path.join(root, 'scripts', 'one-liners.sh'), cmd], {
      cwd: root,
      stdio: 'inherit',
    });

child.on('exit', (code) => process.exit(code ?? 1));
