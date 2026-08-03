/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';

interface MatrixOverlayProps {
  onClose: () => void;
}

export function MatrixOverlay({ onClose }: MatrixOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions based on its container parent dimensions
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      } else {
        canvas.width = 600;
        canvas.height = 300;
      }
    };
    resizeCanvas();

    // Re-trigger slightly on delayed layout sizing
    const delayTimer = setTimeout(resizeCanvas, 100);

    const columns = Math.floor(canvas.width / 12) || 20;
    const drops: number[] = Array(columns).fill(1);

    const matrixChars = "010110010101011100101017892345";

    let animationId: number;

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#10b981'; // emerald-500
      ctx.font = '10px monospace';

      for (let i = 0; i < drops.length; i++) {
        const text = matrixChars[Math.floor(Math.random() * matrixChars.length)];
        const x = i * 12;
        const y = drops[i] * 12;

        ctx.fillText(text, x, y);

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }

        drops[i]++;
      }
      animationId = requestAnimationFrame(draw);
    };

    draw();

    window.addEventListener('resize', resizeCanvas);
    return () => {
      clearTimeout(delayTimer);
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <div 
      className="absolute inset-0 z-40 bg-black/95 flex flex-col justify-between overflow-hidden rounded-lg animate-fade-in pointer-events-auto select-none border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
      id="matrix-overlay-container"
      onClick={onClose}
      title="Click anywhere to close matrix overlay"
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60 pointer-events-none" />
      
      {/* HUD Info Header */}
      <div 
        className="z-10 flex justify-between items-center p-2.5 bg-black/80 backdrop-blur-sm border-b border-emerald-500/20 font-mono text-[9px] text-emerald-400"
        onClick={(e) => e.stopPropagation()} // Allow clicking header buttons without trigger closure
      >
        <span className="flex items-center gap-1.5 font-bold tracking-widest animate-pulse">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
          ■ MATRIX MAIN FRAME DIRECT STREAM ACTIVE
        </span>
        <button 
          onClick={onClose}
          className="px-1.5 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/30 text-emerald-300 rounded border border-emerald-500/30 transition-all font-bold cursor-pointer text-[8px]"
          id="matrix-dismiss-btn"
        >
          DISMISS [X]
        </button>
      </div>

      {/* Footer hint */}
      <div className="z-10 text-center p-1.5 bg-black/60 backdrop-blur-[1px] font-mono text-[8px] text-emerald-500/80 tracking-wide uppercase border-t border-emerald-500/10">
        Click overlay to restore diagnostics console
      </div>
    </div>
  );
}
