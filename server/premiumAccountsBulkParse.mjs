/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Parse bulk vault paste blocks:
 *   Name: {Website Name}
 *   Username: {Username}
 *   Password: {Password}
 *   Url: {url}
 *
 * Blocks may be separated by blank lines or consecutive Name: lines.
 */
export function parseVaultBulkText(raw) {
  const lines = String(raw ?? '').split(/\r?\n/);
  const entries = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    const hasData = current.name || current.username || current.password || current.url;
    if (hasData) entries.push({ ...current });
    current = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const nameMatch = trimmed.match(/^name:\s*(.+)$/i);
    if (nameMatch) {
      flush();
      current = {
        name: nameMatch[1].trim(),
        username: '',
        password: '',
        url: '',
      };
      continue;
    }

    if (!current) current = { name: '', username: '', password: '', url: '' };

    const userMatch = trimmed.match(/^username:\s*(.+)$/i);
    if (userMatch) {
      current.username = userMatch[1].trim();
      continue;
    }
    const passMatch = trimmed.match(/^password:\s*(.+)$/i);
    if (passMatch) {
      current.password = passMatch[1].trim();
      continue;
    }
    const urlMatch = trimmed.match(/^url:\s*(.+)$/i);
    if (urlMatch) {
      current.url = urlMatch[1].trim();
      continue;
    }
  }

  flush();

  return entries.map((entry, index) => {
    const errors = [];
    if (!entry.name) errors.push('Name missing');
    if (!entry.username) errors.push('Username missing');
    if (!entry.password) errors.push('Password missing');
    return {
      index: index + 1,
      name: entry.name,
      username: entry.username,
      password: entry.password,
      url: entry.url,
      valid: errors.length === 0,
      errors,
    };
  });
}