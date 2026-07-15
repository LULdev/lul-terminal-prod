/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { invalidateSession } from './sessionEvents';
import { validateImageFileMagic } from './imageMime';
import { SessionExpiredError, sessionFetch } from './sessionFetch';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
]);

const API = '/api/images';
const VIEW_SESSION_PREFIX = 'lul_img_view_';
const viewInflight = new Map<string, Promise<number>>();

export type HostedImageMeta = {
  id: string;
  url: string;
  viewUrl?: string;
  name: string;
  mime: string;
  size: number;
  width?: number;
  height?: number;
  createdAt: number;
  updatedAt?: number | null;
  views?: number;
  favorite?: boolean;
  tags?: string[];
};

export type GallerySort = 'newest' | 'oldest' | 'views' | 'size' | 'name' | 'favorites';

export type MyGalleryStats = {
  count: number;
  totalViews: number;
  totalBytes: number;
  favorites: number;
  avgViews: number;
  byMime: Record<string, number>;
  topViewedId: string | null;
  topViewedViews: number;
  storageLimitBytes: number;
};

export type MyGalleryResponse = {
  images: HostedImageMeta[];
  total: number;
};

export type HostingStats = {
  imagesHosted: number;
  imageViewsTotal: number;
};

const HOSTED_ID_RE = /^[a-f0-9]{16}$/;

export function parseImageViewerId(): string | null {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash.startsWith('i/')) {
    const id = hash.slice(2).split(/[?#]/)[0] || null;
    return id && HOSTED_ID_RE.test(id) ? id : null;
  }
  const match = window.location.pathname.match(/^\/i\/([^/]+)\/?$/);
  const id = match?.[1] ?? null;
  return id && HOSTED_ID_RE.test(id) ? id : null;
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildViewUrl(id: string): string {
  return `${window.location.origin}/i/${id}`;
}

export function buildDirectUrl(id: string): string {
  return `${window.location.origin}/hosting/${id}`;
}

export function buildMarkdown(name: string, url: string): string {
  const safeName = name.replace(/[\]\\]/g, '\\$&');
  return `![${safeName}](${url})`;
}

export function buildBbcode(url: string): string {
  return `[img]${url}[/img]`;
}

export function buildHtml(url: string, alt: string): string {
  return `<img src="${escapeHtmlAttr(url)}" alt="${escapeHtmlAttr(alt)}" />`;
}

async function readImageDimensions(file: File): Promise<{ width?: number; height?: number }> {
  if (file.type === 'image/svg+xml') return {};
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
    img.src = url;
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_MIME.has(file.type)) {
    return 'Only images (JPG, PNG, GIF, WebP, AVIF, BMP) allowed.';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `Maximum ${(MAX_IMAGE_BYTES / 1024 / 1024).toFixed(0)} MB per image.`;
  }
  return null;
}

export async function validateImageFileAsync(file: File): Promise<string | null> {
  const err = validateImageFile(file);
  if (err) return err;
  return validateImageFileMagic(file, ALLOWED_MIME);
}

export async function fetchHostingStats(): Promise<HostingStats> {
  const res = await fetch(`${API}/stats`);
  if (!res.ok) return { imagesHosted: 0, imageViewsTotal: 0 };
  return res.json() as Promise<HostingStats>;
}

export type UploadHostedImageOptions = {
  /** Skip generic Image Hosting BOT post (e.g. meme export uses its own activity). */
  source?: 'meme' | 'hosting';
};

export async function uploadHostedImage(
  file: File,
  onProgress: (percent: number) => void,
  opts: UploadHostedImageOptions = {},
): Promise<HostedImageMeta> {
  const err = await validateImageFileAsync(file);
  if (err) throw new Error(err);

  const dims = await readImageDimensions(file);
  const data = await fileToBase64(file);
  const estimatedBytes = Math.floor((data.length * 3) / 4);
  if (estimatedBytes > MAX_IMAGE_BYTES) {
    throw new Error(`Maximum ${(MAX_IMAGE_BYTES / 1024 / 1024).toFixed(0)} MB per image.`);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        if (xhr.status === 401) {
          invalidateSession();
          reject(new SessionExpiredError());
          return;
        }
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(body as HostedImageMeta);
        else reject(new Error(body.error || 'Upload failed'));
      } catch {
        reject(new Error('Invalid server response'));
      }
    };
    xhr.onerror = () => reject(new Error('Server unreachable — run npm run dev'));
    xhr.withCredentials = true;
    const uploadPath = opts.source === 'meme' ? `${API}/meme-upload` : `${API}/upload`;
    xhr.open('POST', uploadPath);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify({
      name: file.name,
      mime: file.type,
      size: file.size,
      ...dims,
      data,
    }));
  });
}

export class ImageFetchError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function fetchHostedImage(
  id: string,
  opts: { credentialed?: boolean } = {},
): Promise<HostedImageMeta | null> {
  const credentialed = opts.credentialed ?? false;
  const init = { headers: { 'Content-Type': 'application/json' } };
  const res = credentialed
    ? await sessionFetch(`${API}/${id}`, init)
    : await fetch(`${API}/${id}`, { ...init, credentials: 'omit' });
  if (res.status === 404) return null;
  if (res.status === 401 || res.status === 403) {
    throw new ImageFetchError(res.status, 'Sign in required');
  }
  if (!res.ok) throw new ImageFetchError(res.status, 'Could not load image');
  return res.json() as Promise<HostedImageMeta>;
}

export async function recordImageView(id: string, opts: { credentialed?: boolean } = {}): Promise<number> {
  const pending = viewInflight.get(id);
  if (pending) return pending;

  const canUseSession = typeof sessionStorage !== 'undefined';
  const run = (async () => {
    const sessionKey = `${VIEW_SESSION_PREFIX}${id}`;
    if (!canUseSession || !sessionStorage.getItem(sessionKey)) {
      try {
        const res = await fetch(`${API}/${id}/view`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json() as { views: number; deduped?: boolean };
          if (canUseSession) sessionStorage.setItem(sessionKey, '1');
          return data.views;
        }
      } catch { /* fall through */ }
    }
    const meta = await fetchHostedImage(id, { credentialed: opts.credentialed });
    return meta?.views ?? 0;
  })();

  viewInflight.set(id, run);
  try {
    return await run;
  } finally {
    if (viewInflight.get(id) === run) viewInflight.delete(id);
  }
}

export function pollImageMeta(
  id: string,
  onUpdate: (meta: HostedImageMeta) => void,
  intervalMs = 4000,
  opts: { credentialed?: boolean } = {},
): () => void {
  let active = true;
  const tick = async () => {
    if (!active || document.hidden) return;
    try {
      const meta = await fetchHostedImage(id, { credentialed: opts.credentialed });
      if (meta && active) onUpdate(meta);
    } catch { /* ignore */ }
  };
  tick();
  const t = setInterval(tick, intervalMs);
  const onVis = () => { if (!document.hidden) void tick(); };
  document.addEventListener('visibilitychange', onVis);
  return () => {
    active = false;
    clearInterval(t);
    document.removeEventListener('visibilitychange', onVis);
  };
}

export async function fetchMyGallery(sort: GallerySort = 'newest'): Promise<MyGalleryResponse> {
  const q = new URLSearchParams({ sort });
  const res = await sessionFetch(`${API}/my?${q}`);
  if (res.status === 429) throw new Error('Too many requests — gallery will retry shortly');
  if (!res.ok) throw new Error('Gallery unavailable');
  return res.json() as Promise<MyGalleryResponse>;
}

export async function fetchMyGalleryStats(): Promise<MyGalleryStats> {
  const res = await sessionFetch(`${API}/my/stats`);
  if (res.status === 429) throw new Error('Too many requests — gallery will retry shortly');
  if (!res.ok) throw new Error('Gallery stats unavailable');
  return res.json() as Promise<MyGalleryStats>;
}

export async function updateHostedImage(
  id: string,
  patch: { name?: string; favorite?: boolean; tags?: string[] },
): Promise<HostedImageMeta> {
  const res = await sessionFetch(`${API}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Update failed');
  return body as HostedImageMeta;
}

export async function deleteHostedImage(id: string): Promise<void> {
  const res = await sessionFetch(`${API}/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Delete failed');
  }
}

export function mimeLabel(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'JPG',
    'image/png': 'PNG',
    'image/gif': 'GIF',
    'image/webp': 'WebP',
    'image/avif': 'AVIF',
    'image/bmp': 'BMP',
    'image/svg+xml': 'SVG',
  };
  return map[mime] ?? mime.replace('image/', '').toUpperCase();
}

export function formatImageBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}