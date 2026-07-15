/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Persistent device signals sent with registration — survives IP rotation.
 */

import { collectVisitorContext } from './visitorContext';

const GUEST_KEY = 'lul_analytics_guest';
const INSTALL_ID_KEY = 'lul_install_id';

function getOrCreateGuestId() {
  try {
    let id = localStorage.getItem(GUEST_KEY);
    if (!id) {
      id = `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(GUEST_KEY, id);
    }
    return id;
  } catch {
    return `g-anon-${Date.now()}`;
  }
}
const STORAGE_DB = 'lul_terminal_reg';
const STORAGE_STORE = 'device';
const STORAGE_KEY = 'storage_id';
async function sha256Hex(text: string): Promise<string> {
  try {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 32);
  } catch {
    let h = 0;
    for (let i = 0; i < text.length; i += 1) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
    return `f${Math.abs(h).toString(16)}${text.length.toString(16)}`.slice(0, 32);
  }
}

/** Long-lived browser install marker — persists across sessions and IP changes. */
export function getOrCreateInstallId(): string {
  try {
    let id = localStorage.getItem(INSTALL_ID_KEY);
    if (!id) {
      id = `inst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(INSTALL_ID_KEY, id);
    }
    return id;
  } catch {
    return `inst_anon_${Date.now().toString(36)}`;
  }
}

/** IndexedDB-backed ID — survives some localStorage clears. */
export async function getOrCreateStorageId(): Promise<string> {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;

    const id = await new Promise<string>((resolve, reject) => {
      const req = indexedDB.open(STORAGE_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORAGE_STORE)) {
          db.createObjectStore(STORAGE_STORE);
        }
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(STORAGE_STORE, 'readwrite');
        const store = tx.objectStore(STORAGE_STORE);
        const getReq = store.get('id');
        getReq.onsuccess = () => {
          if (getReq.result) {
            resolve(String(getReq.result));
            return;
          }
          const next = `stor_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
          store.put(next, 'id');
          tx.oncomplete = () => resolve(next);
        };
        getReq.onerror = () => reject(getReq.error);
      };
    });

    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return `stor_fb_${getOrCreateInstallId().slice(-12)}`;
  }
}

/** Canvas rendering fingerprint. */
export async function buildCanvasHash(): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.textBaseline = 'top';
    ctx.font = '16px "Arial", "Helvetica", sans-serif';
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(0, 0, 120, 48);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('LUL Terminal 🎮', 4, 8);
    ctx.strokeStyle = '#22d3ee';
    ctx.strokeRect(2, 2, 116, 44);
    return sha256Hex(canvas.toDataURL().slice(-120));
  } catch {
    return '';
  }
}

/** WebGL GPU renderer fingerprint. */
export async function buildWebglHash(): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
    if (!gl) return '';
    const ext = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (!ext) return sha256Hex('webgl-no-debug');
    const vendor = (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_VENDOR_WEBGL);
    const renderer = (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL);
    return sha256Hex(`${vendor}|${renderer}`);
  } catch {
    return '';
  }
}

/** Stable device fingerprint from hardware / locale signals (not IP). */
export async function buildDeviceFingerprint(): Promise<string> {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const parts = [
    navigator.userAgent,
    navigator.language,
    (navigator.languages ?? []).slice(0, 4).join(','),
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    navigator.platform || 'unknown',
    String(navigator.hardwareConcurrency ?? 0),
    String(nav.deviceMemory ?? 0),
    String(navigator.maxTouchPoints ?? 0),
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'full',
  ];
  return sha256Hex(parts.join('|'));
}

export type RegistrationContext = {
  installId: string;
  storageId: string;
  fingerprint: string;
  canvasHash: string;
  webglHash: string;
  guestId: string;
  timezone: string;
  screen: string;
  platform: string;
  languages: string;
  deviceType: string;
  colorScheme: string;
  hardwareConcurrency: number;
  deviceMemory: number;
  firstVisitAt: number;
  visitCount: number;
};

export async function collectRegistrationContext(): Promise<RegistrationContext> {
  const visitor = collectVisitorContext(false);
  const [storageId, fingerprint, canvasHash, webglHash] = await Promise.all([
    getOrCreateStorageId(),
    buildDeviceFingerprint(),
    buildCanvasHash(),
    buildWebglHash(),
  ]);
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    installId: getOrCreateInstallId(),
    storageId,
    fingerprint,
    canvasHash,
    webglHash,
    guestId: getOrCreateGuestId(),
    timezone: visitor.timezone,
    screen: visitor.screen,
    platform: visitor.platform,
    languages: visitor.languages,
    deviceType: visitor.deviceType,
    colorScheme: visitor.colorScheme,
    hardwareConcurrency: navigator.hardwareConcurrency ?? 0,
    deviceMemory: nav.deviceMemory ?? 0,
    firstVisitAt: visitor.firstVisitAt,
    visitCount: visitor.visitCount,
  };
}

export async function fetchRegistrationChallenge(): Promise<{ challenge: string; expiresAt: number }> {
  const res = await fetch('/api/auth/register/challenge', { credentials: 'include' });
  if (!res.ok) throw new Error('Registration is temporarily unavailable');
  return res.json() as Promise<{ challenge: string; expiresAt: number }>;
}