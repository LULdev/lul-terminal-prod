/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MemeFontFamily, MemeImageFilters, MemeTextBox, TextPreset } from '../types/meme';

export const MEME_FONTS: { id: MemeFontFamily; label: string; css: string }[] = [
  { id: 'impact', label: 'Impact', css: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif' },
  { id: 'arial', label: 'Arial', css: 'Arial, Helvetica, sans-serif' },
  { id: 'comic', label: 'Comic Sans', css: '"Comic Sans MS", Comic Sans, cursive' },
  { id: 'times', label: 'Times', css: '"Times New Roman", Times, serif' },
  { id: 'courier', label: 'Courier', css: '"Courier New", Courier, monospace' },
];

export function memeFontCss(family: MemeFontFamily): string {
  return MEME_FONTS.find((f) => f.id === family)?.css ?? MEME_FONTS[0].css;
}

export const DEFAULT_FILTERS = (): MemeImageFilters => ({
  flipH: false,
  flipV: false,
  brightness: 100,
  contrast: 100,
  saturate: 100,
});

const baseBox = (overrides: Partial<MemeTextBox> & Pick<MemeTextBox, 'text' | 'x' | 'y'>): Omit<MemeTextBox, 'id'> => ({
  fontSize: 36,
  color: '#ffffff',
  strokeColor: '#000000',
  align: 'center',
  fontFamily: 'impact',
  strokeWidth: 3,
  uppercase: true,
  maxWidth: 90,
  ...overrides,
});

export const DEFAULT_BOXES = (): MemeTextBox[] => [
  { id: 'top', ...baseBox({ text: 'TOP TEXT', x: 50, y: 8 }) },
  { id: 'bottom', ...baseBox({ text: 'BOTTOM TEXT', x: 50, y: 88 }) },
];

export const TEXT_PRESETS: TextPreset[] = [
  {
    id: 'classic',
    label: 'Classic',
    icon: '⬆⬇',
    boxes: [
      baseBox({ text: 'TOP TEXT', x: 50, y: 8 }),
      baseBox({ text: 'BOTTOM TEXT', x: 50, y: 88 }),
    ],
  },
  {
    id: 'drake',
    label: 'Drake',
    icon: '👎👍',
    boxes: [
      baseBox({ text: 'NO', x: 28, y: 28, fontSize: 28, maxWidth: 40 }),
      baseBox({ text: 'YES', x: 28, y: 72, fontSize: 28, maxWidth: 40 }),
    ],
  },
  {
    id: 'nobody',
    label: 'Nobody',
    icon: '🤫',
    boxes: [
      baseBox({ text: 'Nobody:', x: 50, y: 12, fontSize: 30 }),
      baseBox({ text: 'Absolutely nobody:', x: 50, y: 28, fontSize: 26 }),
      baseBox({ text: 'Me:', x: 50, y: 85, fontSize: 32 }),
    ],
  },
  {
    id: 'brain',
    label: 'Brain',
    icon: '🧠',
    boxes: [
      baseBox({ text: 'Small idea', x: 50, y: 18, fontSize: 22 }),
      baseBox({ text: 'Better idea', x: 50, y: 38, fontSize: 22 }),
      baseBox({ text: 'Galaxy brain', x: 50, y: 58, fontSize: 22 }),
      baseBox({ text: 'UNIVERSE BRAIN', x: 50, y: 78, fontSize: 22 }),
    ],
  },
  {
    id: 'distracted',
    label: 'Distracted',
    icon: '👀',
    boxes: [
      baseBox({ text: 'My responsibilities', x: 22, y: 55, fontSize: 18, maxWidth: 35 }),
      baseBox({ text: 'Me', x: 50, y: 55, fontSize: 18, maxWidth: 25 }),
      baseBox({ text: 'New distraction', x: 78, y: 55, fontSize: 18, maxWidth: 35 }),
    ],
  },
  {
    id: 'bernie',
    label: 'Bernie',
    icon: '🧓',
    boxes: [
      baseBox({ text: 'I am once again asking', x: 72, y: 35, fontSize: 20, maxWidth: 45, align: 'left' }),
      baseBox({ text: 'for your support', x: 72, y: 55, fontSize: 20, maxWidth: 45, align: 'left' }),
    ],
  },
  {
    id: 'left-exit',
    label: 'Left Exit',
    icon: '🚪',
    boxes: [
      baseBox({ text: 'The plan', x: 25, y: 30, fontSize: 24, maxWidth: 40 }),
      baseBox({ text: 'What I actually do', x: 75, y: 70, fontSize: 24, maxWidth: 40 }),
    ],
  },
  {
    id: 'panel-4',
    label: '4-Panel',
    icon: '▦',
    boxes: [
      baseBox({ text: 'Panel 1', x: 25, y: 25, fontSize: 22, maxWidth: 42 }),
      baseBox({ text: 'Panel 2', x: 75, y: 25, fontSize: 22, maxWidth: 42 }),
      baseBox({ text: 'Panel 3', x: 25, y: 75, fontSize: 22, maxWidth: 42 }),
      baseBox({ text: 'Panel 4', x: 75, y: 75, fontSize: 22, maxWidth: 42 }),
    ],
  },
];

export const COLOR_PRESETS = [
  { label: 'Classic', fill: '#ffffff', stroke: '#000000' },
  { label: 'Yellow', fill: '#ffff00', stroke: '#000000' },
  { label: 'Red', fill: '#ff4444', stroke: '#000000' },
  { label: 'Cyan', fill: '#00ffff', stroke: '#000000' },
  { label: 'Black', fill: '#111111', stroke: '#ffffff' },
  { label: 'White stroke', fill: '#ffffff', stroke: '#ffffff' },
];

export const POSITION_PRESETS = [
  { label: '↑ Top', x: 50, y: 8 },
  { label: '● Center', x: 50, y: 50 },
  { label: '↓ Bottom', x: 50, y: 88 },
  { label: '← Left', x: 15, y: 50 },
  { label: '→ Right', x: 85, y: 50 },
];

export const SNAP_LINES = [25, 50, 75];

export function snapCoord(v: number, threshold = 3): number {
  for (const s of SNAP_LINES) {
    if (Math.abs(v - s) <= threshold) return s;
  }
  return Math.round(v);
}

export const POPULAR_TAGS = [
  'drake', 'distracted', 'spongebob', 'batman', 'brain',
  'change my mind', 'stonks', 'doge', 'wojak', 'pepe',
];

export const QUICK_PHRASES = [
  'When you realize…',
  'Me explaining to my mom:',
  'POV:',
  'Nobody:',
  'Absolutely nobody:',
  'Me:',
  'My last brain cell:',
  'It do be like that',
  'Task failed successfully',
  'Understandable, have a great day',
  'Is this a pigeon?',
  'Change my mind',
  'Stonks',
  'Big brain time',
  'Wait, that\'s illegal',
];

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidthPx: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidthPx && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

export function applyPreset(preset: TextPreset): MemeTextBox[] {
  return preset.boxes.map((box, i) => ({
    ...box,
    id: i === 0 ? 'top' : i === 1 ? 'bottom' : `preset-${preset.id}-${i}`,
  }));
}