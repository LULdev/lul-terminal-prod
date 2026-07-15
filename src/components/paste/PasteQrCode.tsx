/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { safePastePageUrl } from '../../lib/safePasteUrl';

type Props = {
  url: string;
  size?: number;
  label?: string;
};

export function PasteQrCode({ url, size = 120, label = 'Scan to open' }: Props) {
  const [open, setOpen] = useState(false);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const safeUrl = safePastePageUrl(url);

  useEffect(() => {
    if (!open || !safeUrl) {
      setQrSrc(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(safeUrl, {
      width: size,
      margin: 1,
      color: { dark: '#34d399', light: '#0b0c10' },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrSrc(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrSrc(null);
      });
    return () => { cancelled = true; };
  }, [open, safeUrl, size]);

  if (!safeUrl) return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-[9px] font-mono px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-emerald-300 hover:border-emerald-500/30 transition w-fit"
      >
        <QrCode size={12} />
        {open ? 'Hide QR' : 'QR share'}
      </button>
      {open && qrSrc && (
        <div className="flex items-start gap-3 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 animate-fade-in">
          <img
            src={qrSrc}
            alt="QR code for paste link"
            width={size}
            height={size}
            className="rounded-lg border border-slate-800 bg-[#0b0c10] shrink-0"
          />
          <div className="min-w-0 pt-1">
            <p className="text-[9px] font-mono text-emerald-300/90 uppercase tracking-wide mb-1">{label}</p>
            <p className="text-[8px] font-mono text-slate-500 break-all leading-relaxed">{safeUrl}</p>
          </div>
        </div>
      )}
    </div>
  );
}