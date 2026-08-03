/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { ActionButton, OutputBox, TerminalInput, TerminalTextarea } from '../pages/PageShell';
import { runToolExecutor } from '../../data/toolVault';
import type { ToolDefinition } from '../../data/toolVault/types';
import { randomInt } from '../../utils/generators';

type Props = { tool: ToolDefinition };

function ToolFrame({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

export function ToolVaultItem({ tool }: Props) {
  const [input, setInput] = useState(tool.defaultInput ?? '');
  const [input2, setInput2] = useState('');
  const [shift, setShift] = useState('3');
  const [dice, setDice] = useState('20');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [swMs, setSwMs] = useState(0);
  const [swRunning, setSwRunning] = useState(false);
  const [cdLeft, setCdLeft] = useState(0);
  const swRef = useRef(0);

  useEffect(() => {
    setInput(tool.defaultInput ?? '');
    setInput2('');
    setOutput('');
  }, [tool.id, tool.defaultInput]);

  useEffect(() => {
    if (!swRunning) return;
    const t = setInterval(() => setSwMs(Date.now() - swRef.current), 50);
    return () => clearInterval(t);
  }, [swRunning]);

  useEffect(() => {
    if (cdLeft <= 0) return;
    const t = setTimeout(() => setCdLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [cdLeft]);

  const run = async () => {
    setLoading(true);
    try {
      const result = await runToolExecutor(tool.id, input, input2, { shift, dice });
      setOutput(result);
    } catch (e) {
      setOutput(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  if (tool.customUi === 'stopwatch') {
    return (
      <ToolFrame>
        <div className="text-3xl font-mono text-cyan-300">{(swMs / 1000).toFixed(2)}s</div>
        <div className="flex gap-2 flex-wrap">
          <ActionButton onClick={() => { swRef.current = Date.now(); setSwMs(0); setSwRunning(true); }} variant="cyan">Start</ActionButton>
          <ActionButton onClick={() => setSwRunning(false)} variant="rose">Stop</ActionButton>
          <ActionButton onClick={() => { setSwRunning(false); setSwMs(0); }} variant="indigo">Reset</ActionButton>
        </div>
      </ToolFrame>
    );
  }

  if (tool.customUi === 'countdown') {
    return (
      <ToolFrame>
        <TerminalInput value={input} onChange={setInput} placeholder="Seconds" />
        <div className="text-2xl font-mono text-amber-300">{cdLeft > 0 ? `${cdLeft}s` : '—'}</div>
        <ActionButton onClick={() => setCdLeft(parseInt(input, 10) || 10)} variant="amber">Start</ActionButton>
      </ToolFrame>
    );
  }

  if (tool.customUi === 'dice') {
    return (
      <ToolFrame>
        <TerminalInput value={dice} onChange={setDice} placeholder="Sides (6, 20, 100)" />
        <ActionButton onClick={async () => { setOutput(`D${dice}: ${randomInt(1, parseInt(dice, 10) || 6)}`); }} variant="cyan">Roll</ActionButton>
        {output && <OutputBox>{output}</OutputBox>}
      </ToolFrame>
    );
  }

  const showTextarea = tool.inputMode === 'textarea';
  const showSingle = tool.inputMode === 'single' || tool.inputMode === 'textarea';
  const showDual = tool.inputMode === 'dual';
  const showNone = tool.inputMode === 'none';

  return (
    <ToolFrame>
      {showSingle && !showNone && (
        showTextarea
          ? <TerminalTextarea value={input} onChange={setInput} rows={4} placeholder={tool.placeholder ?? 'Input…'} />
          : <TerminalInput value={input} onChange={setInput} placeholder={tool.placeholder ?? 'Input…'} />
      )}
      {showDual && (
        <>
          <TerminalInput value={input} onChange={setInput} placeholder={tool.placeholder ?? 'Value 1…'} />
          <TerminalInput value={input2} onChange={setInput2} placeholder={tool.placeholder2 ?? 'Value 2…'} />
        </>
      )}
      {tool.id === 'caesar-cipher' && (
        <TerminalInput value={shift} onChange={setShift} placeholder="Shift (3)" />
      )}
      <ActionButton onClick={run} variant="cyan" disabled={loading}>
        {loading ? 'Running…' : showNone ? 'Execute' : 'Run Tool'}
      </ActionButton>
      {output && <OutputBox>{output}</OutputBox>}
    </ToolFrame>
  );
}