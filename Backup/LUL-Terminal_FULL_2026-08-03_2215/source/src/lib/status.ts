/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */



export type ServiceStatus = 'operational' | 'degraded' | 'down';

export type StatusCheck = {
  id: string;
  label: string;
  group: string;
  icon: string;
  status: ServiceStatus;
  latencyMs: number;
  message: string;
  metric: string | null;
};

export type StatusGroup = {
  id: string;
  label: string;
  checks: StatusCheck[];
};

export type SystemStatus = {
  generatedAt: number;
  version: string;
  uptimeSec: number;
  summary: {
    operational: number;
    degraded: number;
    down: number;
    total: number;
    avgLatencyMs: number;
    overall: 'operational' | 'degraded' | 'partial' | 'major';
  };
  groups: StatusGroup[];
  checks: StatusCheck[];
};

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const res = await fetch('/api/status');
  if (!res.ok) throw new Error('Status unavailable');
  return res.json() as Promise<SystemStatus>;
}

export function formatUptime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

export const STATUS_META: Record<ServiceStatus, { label: string; dot: string; text: string; border: string }> = {
  operational: {
    label: 'Operational',
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
    border: 'border-emerald-500/30',
  },
  degraded: {
    label: 'Degraded',
    dot: 'bg-amber-400',
    text: 'text-amber-300',
    border: 'border-amber-500/30',
  },
  down: {
    label: 'Down',
    dot: 'bg-rose-400',
    text: 'text-rose-300',
    border: 'border-rose-500/30',
  },
};

export const OVERALL_META: Record<SystemStatus['summary']['overall'], { label: string; accent: string; bg: string }> = {
  operational: { label: 'All Systems Operational', accent: 'text-emerald-300', bg: 'from-emerald-950/50' },
  degraded: { label: 'Minor Issues Detected', accent: 'text-amber-300', bg: 'from-amber-950/40' },
  partial: { label: 'Partial Outage', accent: 'text-orange-300', bg: 'from-orange-950/40' },
  major: { label: 'Major Outage', accent: 'text-rose-300', bg: 'from-rose-950/40' },
};