/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NewsArticle, NewsArticleInput, NewsFeedResponse } from '../types/news';
import { sessionFetch } from './sessionFetch';

const API = '/api/news';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await sessionFetch(`${API}${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

export async function fetchNewsMeta(): Promise<{ feedVersion: string }> {
  const res = await fetch(`${API}/meta`);
  if (!res.ok) return { feedVersion: '0.0.0' };
  return res.json();
}

export async function fetchNewsFeed(): Promise<NewsFeedResponse> {
  const res = await fetch(API);
  if (!res.ok) throw new Error('News feed unavailable');
  const data = await res.json() as Partial<NewsFeedResponse>;
  return {
    feedVersion: String(data.feedVersion ?? '0.0.0'),
    articles: Array.isArray(data.articles) ? data.articles : [],
  };
}

export async function fetchAdminNews(): Promise<NewsFeedResponse> {
  return api('/admin');
}

export async function createNewsArticle(input: NewsArticleInput): Promise<{ article: NewsArticle; feedVersion: string }> {
  return api('', { method: 'POST', body: JSON.stringify(input) });
}

export async function updateNewsArticle(
  id: string,
  input: Partial<NewsArticleInput>,
): Promise<{ article: NewsArticle; feedVersion: string }> {
  return api(`/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export async function deleteNewsArticle(id: string): Promise<{ ok: boolean; feedVersion: string }> {
  return api(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function formatNewsDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}