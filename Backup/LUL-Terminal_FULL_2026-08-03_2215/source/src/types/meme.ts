/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type MemeTemplateType = 'image' | 'gif' | 'upload';

export type MemeTemplate = {
  id: string;
  name: string;
  path: string;
  type: MemeTemplateType;
  previewUrl: string;
  mediaUrl: string;
  sourcePage?: number;
};

export type MemeCatalog = {
  scrapedAt: string;
  source: string;
  staticPages?: string;
  gifPages?: string;
  total: number;
  staticCount: number;
  gifCount: number;
  duplicatesRemoved?: number;
  templates: MemeTemplate[];
};

export type MemeFontFamily = 'impact' | 'arial' | 'comic' | 'times' | 'courier';

export type MemeTextBox = {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  strokeColor: string;
  align: 'left' | 'center' | 'right';
  fontFamily: MemeFontFamily;
  strokeWidth: number;
  uppercase: boolean;
  maxWidth: number;
};

export type MemeImageFilters = {
  flipH: boolean;
  flipV: boolean;
  brightness: number;
  contrast: number;
  saturate: number;
};

export type MemeEditorSnapshot = {
  boxes: MemeTextBox[];
  filters: MemeImageFilters;
};

export type TextPreset = {
  id: string;
  label: string;
  icon: string;
  boxes: Omit<MemeTextBox, 'id'>[];
};