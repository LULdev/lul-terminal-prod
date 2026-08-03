/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'data', 'access-control.json');

/** Tabs that must stay public (profile links). */
export const LOCKED_PUBLIC_TABS = new Set(['profile']);

/** Tabs that must stay members-only (admin role checked separately). */
export const LOCKED_MEMBERS_TABS = new Set(['admin']);

export const ALL_MANAGEABLE_TAB_IDS = [
  'dashboard', 'stats', 'status', 'leaderboard', 'games', 'news', 'fun', 'faq', 'invite', 'changelog', 'memegen', 'imagehost', 'paste',
  'proxydatabase', 'premiumaccounts', 'tools', 'identity', 'textlab', 'colorlab',
  'meme', 'toolvault', 'profile', 'activity', 'admin',
];

export const DEFAULT_VISIBILITY = {
  stats: 'public',
  status: 'public',
  leaderboard: 'public',
  games: 'members',
  news: 'public',
  faq: 'public',
  changelog: 'public',
  profile: 'public',
  fun: 'public',
  dashboard: 'members',
  invite: 'members',
  memegen: 'members',
  imagehost: 'members',
  paste: 'members',
  proxydatabase: 'members',
  premiumaccounts: 'members',
  tools: 'members',
  identity: 'members',
  textlab: 'members',
  colorlab: 'members',
  meme: 'members',
  toolvault: 'members',
  activity: 'members',
  admin: 'members',
};

/** Site chrome / layout flags (not tabs). */
export const DEFAULT_UI = {
  /** Right diagnostics / shoutbox pane on the main shell */
  showDiagnosticsPane: true,
};

function sanitizeUi(ui = {}) {
  return {
    showDiagnosticsPane: ui.showDiagnosticsPane !== false,
  };
}

function normalizeVisibility(value) {
  return value === 'public' ? 'public' : 'members';
}

function sanitizePages(pages = {}) {
  const out = { ...DEFAULT_VISIBILITY };
  for (const id of ALL_MANAGEABLE_TAB_IDS) {
    if (pages[id] !== undefined) {
      let vis = normalizeVisibility(pages[id]);
      if (LOCKED_PUBLIC_TABS.has(id)) vis = 'public';
      if (LOCKED_MEMBERS_TABS.has(id)) vis = 'members';
      out[id] = vis;
    }
  }
  return out;
}

export async function loadAccessControl() {
  let exists = true;
  try {
    await fs.access(DATA_FILE);
  } catch {
    exists = false;
  }
  if (!exists) {
    return {
      version: 1,
      updatedAt: null,
      pages: { ...DEFAULT_VISIBILITY },
      ui: { ...DEFAULT_UI },
    };
  }
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      version: parsed.version ?? 1,
      updatedAt: parsed.updatedAt ?? null,
      pages: sanitizePages(parsed.pages),
      ui: sanitizeUi(parsed.ui),
    };
  } catch (err) {
    console.error('[access] CRITICAL: access-control.json unreadable', err);
    throw new Error('Access control database unavailable');
  }
}

let accessControlWriteChain = Promise.resolve();

function withAccessControlWrite(task) {
  const run = accessControlWriteChain.then(() => task());
  accessControlWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

export async function saveAccessControl(patch = {}) {
  return withAccessControlWrite(async () => {
    const current = await loadAccessControl();
    const nextPages = sanitizePages({
      ...current.pages,
      ...(patch.pages ?? {}),
    });
    const nextUi = sanitizeUi({
      ...current.ui,
      ...(patch.ui && typeof patch.ui === 'object' ? patch.ui : {}),
    });
    // Full reset of pages also restores UI defaults when explicitly requested
    if (patch.resetUiDefaults) {
      Object.assign(nextUi, DEFAULT_UI);
    }
    const db = {
      version: 1,
      updatedAt: Date.now(),
      pages: nextPages,
      ui: nextUi,
    };
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
    await fs.rename(tmp, DATA_FILE);
    return db;
  });
}

export function isTabPublic(pages, tabId) {
  const vis = pages?.[tabId] ?? DEFAULT_VISIBILITY[tabId] ?? 'members';
  return vis === 'public';
}

export function publicTabIds(pages) {
  return ALL_MANAGEABLE_TAB_IDS.filter((id) => isTabPublic(pages, id));
}