/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Full-viewport confetti for the unlocking user only (mounted from AchievementNotification).
 */

import React, { useEffect, useRef } from 'react';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  color: string;
  life: number;
  decay: number;
  shape: 0 | 1 | 2;
};

const COLORS = [
  '#fbbf24',
  '#f59e0b',
  '#a78bfa',
  '#8b5cf6',
  '#38bdf8',
  '#34d399',
  '#f472b6',
  '#fb7185',
  '#fde68a',
  '#e0e7ff',
];

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type AchievementConfettiProps = {
  /** Re-fire when this key changes (e.g. joined unlock ids). */
  burstKey: string;
  particleCount?: number;
};

export function AchievementConfetti({
  burstKey,
  particleCount = 160,
}: AchievementConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!burstKey || prefersReducedMotion()) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const w = () => window.innerWidth;
    const h = () => window.innerHeight;

    const particles: Particle[] = [];
    const n = Math.max(40, Math.min(280, particleCount));

    // Multi-burst from top center + sides for full-page coverage
    const origins = [
      { x: w() * 0.5, y: h() * 0.15 },
      { x: w() * 0.2, y: h() * 0.25 },
      { x: w() * 0.8, y: h() * 0.25 },
      { x: w() * 0.5, y: h() * 0.05 },
    ];

    for (let i = 0; i < n; i++) {
      const o = origins[i % origins.length];
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.35;
      const speed = 6 + Math.random() * 12;
      particles.push({
        x: o.x + (Math.random() - 0.5) * 40,
        y: o.y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 4,
        vy: Math.sin(angle) * speed - Math.random() * 4,
        w: 5 + Math.random() * 7,
        h: 3 + Math.random() * 5,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.35,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        life: 1,
        decay: 0.004 + Math.random() * 0.008,
        shape: (Math.floor(Math.random() * 3) as 0 | 1 | 2),
      });
    }

    const gravity = 0.18;
    const drag = 0.992;

    const frame = () => {
      if (!running) return;
      const width = w();
      const height = h();
      ctx.clearRect(0, 0, width, height);

      let alive = 0;
      for (const p of particles) {
        if (p.life <= 0) continue;
        alive += 1;
        p.vy += gravity;
        p.vx *= drag;
        p.vy *= drag;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= p.decay;

        if (p.y > height + 40 || p.x < -40 || p.x > width + 40) {
          p.life = 0;
          continue;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.fillStyle = p.color;

        if (p.shape === 0) {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        } else if (p.shape === 1) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w * 0.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -p.h);
          ctx.lineTo(p.w / 2, p.h / 2);
          ctx.lineTo(-p.w / 2, p.h / 2);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      if (alive > 0) {
        raf = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      ctx.clearRect(0, 0, w(), h());
    };
  }, [burstKey, particleCount]);

  return (
    <canvas
      ref={canvasRef}
      className="achievement-confetti-canvas"
      aria-hidden
    />
  );
}
