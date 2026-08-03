/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronRight, Database } from 'lucide-react';
import { AdminProxyCheckerPanel } from './AdminProxyCheckerPanel';
import { AdminProxyScraperPanel } from './AdminProxyScraperPanel';

type ProxyStep = 'scraper' | 'checker';

export function AdminProxyPipeline() {
  const [activeStep, setActiveStep] = useState<ProxyStep>('scraper');
  const [checkerPulse, setCheckerPulse] = useState(false);
  const [scrapeReady, setScrapeReady] = useState(false);
  const scraperRef = useRef<HTMLDivElement>(null);
  const checkerRef = useRef<HTMLDivElement>(null);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pulseChecker = useCallback(() => {
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    setCheckerPulse(true);
    pulseTimer.current = setTimeout(() => setCheckerPulse(false), 2800);
  }, []);

  const scrollTo = useCallback((step: ProxyStep) => {
    const el = step === 'scraper' ? scraperRef.current : checkerRef.current;
    setActiveStep(step);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (step === 'checker') pulseChecker();
  }, [pulseChecker]);

  const onScrapeSuccess = useCallback(() => {
    setScrapeReady(true);
    scrollTo('checker');
  }, [scrollTo]);

  useEffect(() => {
    const sections: { step: ProxyStep; el: HTMLElement | null }[] = [
      { step: 'scraper', el: scraperRef.current },
      { step: 'checker', el: checkerRef.current },
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id === 'admin-proxy-scraper') setActiveStep('scraper');
        if (visible[0]?.target.id === 'admin-proxy-checker') setActiveStep('checker');
      },
      { root: null, rootMargin: '-20% 0px -55% 0px', threshold: [0.15, 0.4, 0.7] },
    );

    for (const { el } of sections) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => {
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
  }, []);

  return (
    <section className="space-y-4" aria-label="Proxy Pipeline">
      <div className="rounded-2xl border border-teal-500/25 bg-gradient-to-br from-teal-950/35 via-[#0c0d12] to-indigo-950/25 p-4 shadow-[0_0_40px_rgba(45,212,191,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span aria-hidden>🔄</span> Proxy Pipeline
            </h3>
            <p className="text-[9px] font-mono text-slate-500 mt-1 max-w-md leading-relaxed">
              Step by step: scrape sources → live check → results in the public Proxy Database.
            </p>
          </div>

          <nav className="flex flex-wrap gap-1.5" aria-label="Proxy steps">
            <JumpPill active={activeStep === 'scraper'} step={1} label="Scraper" icon="🕸️" onClick={() => scrollTo('scraper')} />
            <JumpPill active={activeStep === 'checker'} step={2} label="Checker" icon="🔍" onClick={() => scrollTo('checker')} highlight={scrapeReady} />
          </nav>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <WorkflowStep
            n={1}
            title="Scrape"
            desc="Sources & custom URLs"
            active={activeStep === 'scraper'}
            done={scrapeReady}
            onClick={() => scrollTo('scraper')}
          />
          <WorkflowStep
            n={2}
            title="Check"
            desc="Anonymity · HTTPS · latency"
            active={activeStep === 'checker'}
            onClick={() => scrollTo('checker')}
          />
          <WorkflowStep
            n={3}
            title="Database"
            desc="Public · auto-sync"
            active={false}
            external
          />
        </div>
      </div>

      <div id="admin-proxy-scraper" ref={scraperRef} className="scroll-mt-3">
        <StepLabel n={1} title="Proxy Scraper" />
        <AdminProxyScraperPanel
          onScrapeSuccess={onScrapeSuccess}
          onGoToChecker={() => scrollTo('checker')}
          scrapeReady={scrapeReady}
        />
      </div>

      <div className="flex justify-center py-1">
        <button
          type="button"
          onClick={() => scrollTo('checker')}
          className="group inline-flex items-center gap-2 px-4 py-2 rounded-full border border-teal-500/30 bg-teal-500/10 text-[10px] font-mono text-teal-200 hover:bg-teal-500/20 hover:border-teal-400/50 transition-all"
        >
          Continue to checker
          <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      <div
        id="admin-proxy-checker"
        ref={checkerRef}
        className={`scroll-mt-3 rounded-2xl transition-all duration-500 ${
          checkerPulse ? 'ring-2 ring-teal-400/60 ring-offset-2 ring-offset-[#0c0d12] shadow-[0_0_30px_rgba(45,212,191,0.12)]' : ''
        }`}
      >
        <StepLabel n={2} title="Proxy Checker" />
        <AdminProxyCheckerPanel onGoToScraper={() => scrollTo('scraper')} />
      </div>
    </section>
  );
}

function JumpPill({
  active,
  step,
  label,
  icon,
  onClick,
  highlight,
}: {
  active: boolean;
  step: number;
  label: string;
  icon: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-mono transition-all ${
        active
          ? 'border-teal-400/50 bg-teal-500/20 text-teal-100 shadow-[0_0_12px_rgba(45,212,191,0.15)]'
          : highlight
            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200 animate-pulse'
            : 'border-slate-800 bg-black/30 text-slate-500 hover:text-slate-300 hover:border-slate-700'
      }`}
    >
      <span className="w-4 h-4 rounded-full bg-black/40 flex items-center justify-center text-[8px] font-bold">{step}</span>
      <span>{icon}</span>
      {label}
    </button>
  );
}

function WorkflowStep({
  n,
  title,
  desc,
  active,
  done,
  onClick,
  external,
}: {
  n: number;
  title: string;
  desc: string;
  active: boolean;
  done?: boolean;
  onClick?: () => void;
  external?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${
            done
              ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
              : active
                ? 'border-teal-400/50 bg-teal-500/20 text-teal-200'
                : 'border-slate-700 bg-black/30 text-slate-500'
          }`}
        >
          {done ? <CheckCircle2 size={12} /> : n}
        </span>
        <span className={`text-[11px] font-semibold ${active || done ? 'text-slate-200' : 'text-slate-500'}`}>{title}</span>
        {!external && active && <ChevronRight size={12} className="text-teal-400 ml-auto" />}
        {external && <Database size={12} className="text-indigo-400 ml-auto" />}
      </div>
      <p className="text-[8px] font-mono text-slate-600 pl-8">{desc}</p>
    </>
  );

  if (external) {
    return (
      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-3 py-2.5">
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2.5 text-left transition-all hover:border-teal-500/35 ${
        active ? 'border-teal-500/35 bg-teal-500/10' : 'border-slate-800/80 bg-black/20 hover:bg-black/30'
      }`}
    >
      {inner}
    </button>
  );
}

function StepLabel({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2 px-1">
      <span className="flex items-center justify-center w-5 h-5 rounded-md border border-teal-500/30 bg-teal-500/10 text-[9px] font-mono font-bold text-teal-300">
        {n}
      </span>
      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">{title}</span>
      <div className="flex-1 h-px bg-gradient-to-r from-slate-800 to-transparent" />
    </div>
  );
}