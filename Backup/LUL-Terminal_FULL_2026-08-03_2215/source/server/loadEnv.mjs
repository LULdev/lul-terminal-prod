/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export function isTrustProxyEnabled() {
  return process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';
}