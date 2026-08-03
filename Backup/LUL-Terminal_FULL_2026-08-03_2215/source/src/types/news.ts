/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type NewsArticle = {
  id: string;
  title: string;
  body: string;
  category: string;
  icon?: string;
  highlight?: boolean;
  active: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  authorName: string;
};

export type NewsFeedResponse = {
  feedVersion: string;
  articles: NewsArticle[];
};

export type NewsArticleInput = {
  id?: string;
  title: string;
  body: string;
  category?: string;
  icon?: string;
  highlight?: boolean;
  active?: boolean;
  publishedAt?: string;
};