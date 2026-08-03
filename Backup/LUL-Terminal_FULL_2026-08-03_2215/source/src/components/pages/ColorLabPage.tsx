/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ActionButton, PageShell, TerminalInput, ToolCard } from './PageShell';
import { contrastRatio, generatePalette, hexToRgb } from '../../utils/generators';

export function ColorLabPage() {
  const [hex, setHex] = useState('#6366f1');
  const [hex2, setHex2] = useState('#0b0c10');
  const [seed, setSeed] = useState('lul-terminal');
  const rgb = hexToRgb(hex);

  return (
    <PageShell
      id="colorlab-module"
      pageId="colorlab"
      icon="🎨"
      title="Color Spectrum"
      subtitle="Palettes, contrast checks & HEX/RGB — visual design lab in CRT style."
      accentClass="text-rose-400"
    >
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <ToolCard title="Color Picker" icon="🎯" accent="rose">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              className="w-12 h-12 rounded border border-slate-700 bg-transparent cursor-pointer"
            />
            <TerminalInput value={hex} onChange={setHex} placeholder="#6366f1" />
          </div>
          <div
            className="mt-3 h-16 rounded border border-slate-700/60"
            style={{ backgroundColor: hex }}
          />
          {rgb && (
            <p className="mt-2 text-[10px] font-mono text-slate-400">
              RGB({rgb.r}, {rgb.g}, {rgb.b})
            </p>
          )}
        </ToolCard>

        <ToolCard title="Contrast Checker (WCAG)" icon="⚖️" accent="amber">
          <div className="grid grid-cols-2 gap-2">
            <TerminalInput value={hex} onChange={setHex} placeholder="Foreground" />
            <TerminalInput value={hex2} onChange={setHex2} placeholder="Background" />
          </div>
          <div
            className="mt-3 p-4 rounded border border-slate-700 text-center font-bold"
            style={{ backgroundColor: hex2, color: hex }}
          >
            Sample Text Aa
          </div>
          <p className="mt-2 text-[10px] font-mono text-slate-300">
            Ratio: <span className="text-amber-400 font-bold">{contrastRatio(hex, hex2) ?? 'n/a'}</span>
            {' '}(≥4.5 = AA normal text)
          </p>
        </ToolCard>

        <ToolCard title="Palette from Seed" icon="🌈" accent="violet">
          <TerminalInput value={seed} onChange={setSeed} placeholder="Seed word…" />
          <div className="mt-3 flex gap-2">
            {generatePalette(seed).map((color, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full h-10 rounded border border-slate-700/50" style={{ backgroundColor: color }} />
                <span className="text-[8px] text-slate-500 font-mono">{i + 1}</span>
              </div>
            ))}
          </div>
          <ActionButton onClick={() => setSeed(`${seed}-${Date.now()}`)} variant="indigo">Reshuffle</ActionButton>
        </ToolCard>

        <ToolCard title="Terminal Theme Swatches" icon="🖥️" accent="cyan">
          <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
            {[
              { name: 'Indigo Glow', hex: '#6366f1' },
              { name: 'Emerald HUD', hex: '#34d399' },
              { name: 'Amber Trap', hex: '#f59e0b' },
              { name: 'CRT Slate', hex: '#11131b' },
              { name: 'Rose Alert', hex: '#f43f5e' },
              { name: 'Cyan Net', hex: '#22d3ee' },
            ].map((sw) => (
              <button
                key={sw.hex}
                type="button"
                onClick={() => setHex(sw.hex)}
                className="flex items-center gap-2 p-2 bg-black/30 rounded border border-slate-800 hover:border-slate-600 text-left"
              >
                <span className="w-5 h-5 rounded shrink-0 border border-slate-700" style={{ backgroundColor: sw.hex }} />
                <span className="text-slate-400">{sw.name}</span>
              </button>
            ))}
          </div>
        </ToolCard>
      </div>
    </PageShell>
  );
}