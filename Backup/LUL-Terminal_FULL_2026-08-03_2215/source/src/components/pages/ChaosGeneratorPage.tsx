/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ActionButton, OutputBox, PageShell, ToolCard } from './PageShell';
import { generateAsciiArt } from '../../utils/ascii';
import { generateStartupName, randomFortune, randomJoke } from '../../utils/generators';

const MEMES = [
  '(╯°□°)╯︵ ┻━┻  TABLE FLIP DETECTED',
  '¯\\_(ツ)_/¯  It compiles. Ship it.',
  '(づ｡◕‿‿◕｡)づ  HUG DEPLOYED',
  'ಠ_ಠ  Code review in progress...',
  'ʕ•ᴥ•ʔ  Bear approves this commit.',
];

export function ChaosGeneratorPage() {
  const [joke, setJoke] = useState(randomJoke());
  const [fortune, setFortune] = useState(randomFortune());
  const [meme, setMeme] = useState(MEMES[0]);
  const [startup, setStartup] = useState(generateStartupName());
  const [ascii, setAscii] = useState(generateAsciiArt('CHAOS'));

  return (
    <PageShell
      id="meme-module"
      pageId="meme"
      icon="🎲"
      title="Chaos Generator"
      subtitle="Memes, dev jokes, oracle, startup names & ASCII — pure terminal entropy."
      accentClass="text-orange-400"
    >
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <ToolCard title="Dev Joke Dispenser" icon="😂" accent="orange">
          <OutputBox>{joke}</OutputBox>
          <div className="mt-2">
            <ActionButton onClick={() => setJoke(randomJoke())} variant="amber">New Joke</ActionButton>
          </div>
        </ToolCard>

        <ToolCard title="Terminal Oracle" icon="🔮" accent="violet">
          <OutputBox>{fortune}</OutputBox>
          <div className="mt-2">
            <ActionButton onClick={() => setFortune(randomFortune())} variant="indigo">Consult Oracle</ActionButton>
          </div>
        </ToolCard>

        <ToolCard title="ASCII Meme Banner" icon="🖼️" accent="cyan">
          <OutputBox>{meme}</OutputBox>
          <div className="mt-2 flex gap-2">
            <ActionButton onClick={() => setMeme(MEMES[Math.floor(Math.random() * MEMES.length)])} variant="cyan">
              Random Meme
            </ActionButton>
            <ActionButton onClick={() => setAscii(generateAsciiArt('LUL'))} variant="emerald">ASCII Refresh</ActionButton>
          </div>
          <pre className="mt-2 text-[8px] text-emerald-400 font-mono overflow-x-auto">{ascii}</pre>
        </ToolCard>

        <ToolCard title="Startup Name Forge" icon="🚀" accent="rose">
          <OutputBox>{startup}.io</OutputBox>
          <div className="mt-2">
            <ActionButton onClick={() => setStartup(generateStartupName())} variant="rose">Pivot Again</ActionButton>
          </div>
          <p className="text-[9px] text-slate-500 mt-2">Generates VC-ready names. No guarantee of Series A.</p>
        </ToolCard>

        <ToolCard title="Chaos Roulette" icon="🎰" accent="emerald">
          <ActionButton
            onClick={() => {
              setJoke(randomJoke());
              setFortune(randomFortune());
              setMeme(MEMES[Math.floor(Math.random() * MEMES.length)]);
              setStartup(generateStartupName());
              setAscii(generateAsciiArt(['LUL', 'CHAOS', '404', 'HACK'][Math.floor(Math.random() * 4)]));
            }}
            variant="emerald"
          >
            SPIN ALL WHEELS
          </ActionButton>
        </ToolCard>
      </div>
    </PageShell>
  );
}