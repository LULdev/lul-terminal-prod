/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { revealVaultPassword } from '../../lib/premiumAccounts';

type Props = {
  accountId: string;
  hasPassword?: boolean;
  initialPassword?: string;
  className?: string;
};

export function VaultPasswordReveal({ accountId, hasPassword = true, initialPassword, className = '' }: Props) {
  const [password, setPassword] = useState(initialPassword ?? '');
  const [revealed, setRevealed] = useState(Boolean(initialPassword));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const reveal = useCallback(async () => {
    if (revealed && password) return;
    if (!hasPassword) {
      setError('No password stored');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const pw = await revealVaultPassword(accountId);
      setPassword(pw);
      setRevealed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reveal failed');
    } finally {
      setLoading(false);
    }
  }, [accountId, hasPassword, password, revealed]);

  const copy = async () => {
    if (!password) {
      await reveal();
      return;
    }
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wide">Password</span>
        <div className="flex items-center gap-1">
          {!revealed ? (
            <button
              type="button"
              onClick={() => { void reveal(); }}
              disabled={loading || !hasPassword}
              className="text-[8px] font-mono text-amber-400/90 hover:text-amber-300 disabled:opacity-40"
            >
              {loading ? '…' : <><Eye size={10} className="inline mr-0.5" />Reveal</>}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setRevealed(false); setPassword(''); }}
              className="text-[8px] font-mono text-slate-500 hover:text-slate-300"
            >
              <EyeOff size={10} className="inline" />
            </button>
          )}
          <button
            type="button"
            onClick={() => { void copy(); }}
            disabled={loading}
            className="text-[8px] font-mono text-slate-500 hover:text-emerald-300 disabled:opacity-40"
          >
            {copied ? '✓' : 'Copy'}
          </button>
        </div>
      </div>
      <div className="text-[10px] font-mono text-slate-200 bg-black/40 border border-slate-800/80 rounded px-2 py-1.5 break-all min-h-[28px]">
        {revealed && password ? password : '••••••••'}
      </div>
      {error && <p className="text-[8px] font-mono text-rose-400">{error}</p>}
    </div>
  );
}