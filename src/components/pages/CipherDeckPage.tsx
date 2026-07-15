/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ActionButton, OutputBox, PageShell, TerminalTextarea, ToolCard } from './PageShell';
import { rot13, toMorse } from '../../utils/generators';

export function CipherDeckPage() {
  const [input, setInput] = useState('Hello LUL!');
  const [output, setOutput] = useState('');
  const [hash, setHash] = useState('');

  const encodeBase64 = () => setOutput(btoa(unescape(encodeURIComponent(input))));
  const decodeBase64 = () => {
    try {
      setOutput(decodeURIComponent(escape(atob(input))));
    } catch {
      setOutput('Invalid Base64 input.');
    }
  };
  const encodeUrl = () => setOutput(encodeURIComponent(input));
  const decodeUrl = () => {
    try {
      setOutput(decodeURIComponent(input));
    } catch {
      setOutput('Invalid URL encoding.');
    }
  };

  const sha256 = async () => {
    const data = new TextEncoder().encode(input);
    const buf = await crypto.subtle.digest('SHA-256', data);
    const hex = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    setHash(hex);
  };

  return (
    <PageShell
      id="cipher-module"
      pageId="cipher"
      icon="🔏"
      title="Cipher Deck"
      subtitle="Base64, URL, ROT13, Morse & SHA-256 — encode/decode tools for nerds."
      accentClass="text-indigo-400"
    >
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <ToolCard title="Input / Output" icon="🔄" accent="indigo">
          <TerminalTextarea value={input} onChange={setInput} rows={4} placeholder="Enter text…" />
          {output && <OutputBox>{output}</OutputBox>}
        </ToolCard>

        <ToolCard title="Encoders" icon="🔐" accent="cyan">
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={encodeBase64} variant="cyan">Base64 Encode</ActionButton>
            <ActionButton onClick={decodeBase64} variant="indigo">Base64 Decode</ActionButton>
            <ActionButton onClick={encodeUrl} variant="emerald">URL Encode</ActionButton>
            <ActionButton onClick={decodeUrl} variant="amber">URL Decode</ActionButton>
            <ActionButton onClick={() => setOutput(rot13(input))} variant="rose">ROT13</ActionButton>
            <ActionButton onClick={() => setOutput(toMorse(input))} variant="indigo">Morse</ActionButton>
          </div>
        </ToolCard>

        <ToolCard title="SHA-256 Hash" icon="⚗️" accent="emerald">
          <ActionButton onClick={sha256} variant="emerald">Compute Hash</ActionButton>
          {hash && <OutputBox>{hash}</OutputBox>}
        </ToolCard>

        <ToolCard title="Cipher Facts" icon="📚" accent="amber">
          <ul className="text-[10px] text-slate-400 space-y-1.5 font-mono">
            <li>→ Base64: transport encoding, not encryption</li>
            <li>→ ROT13: symmetric (encode = decode)</li>
            <li>→ Morse: # = unknown character</li>
            <li>→ SHA-256: locally via Web Crypto API</li>
          </ul>
        </ToolCard>
      </div>
    </PageShell>
  );
}