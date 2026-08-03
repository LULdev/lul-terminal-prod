/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Trophy showcase — unlocked grid + structured locked vault (filterable, readable).
 */

import React, { useMemo, useState } from 'react';
import { ChevronDown, Filter, Lock, Search, Sparkles, Trophy } from 'lucide-react';
import {
  ACHIEVEMENT_CATALOG,
  DIFFICULTY_LABELS,
  achievementBadgeClass,
  type AchievementDef,
  type AchievementRarity,
  type EarnedAchievement,
} from '../../data/achievements';
import { TrophyTip } from './TrophyTip';

type AchievementShowcaseProps = {
  earned: EarnedAchievement[];
  compact?: boolean;
};

const RARITY_ORDER: AchievementRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];

const RARITY_META: Record<AchievementRarity, { label: string; icon: string }> = {
  common: { label: 'Common', icon: '◆' },
  rare: { label: 'Rare', icon: '◆' },
  epic: { label: 'Epic', icon: '◆' },
  legendary: { label: 'Legendary', icon: '◆' },
  mythic: { label: 'Mythic', icon: '✦' },
};

type KindFilter = 'all' | 'achievement' | 'award';
type ViewMode = 'locked' | 'unlocked' | 'all';

export function AchievementShowcase({ earned, compact }: AchievementShowcaseProps) {
  const [view, setView] = useState<ViewMode>('locked');
  const [kind, setKind] = useState<KindFilter>('all');
  const [rarity, setRarity] = useState<AchievementRarity | 'all'>('all');
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const earnedMap = useMemo(
    () => new Map(earned.map((e) => [e.id, e.earnedAt])),
    [earned],
  );

  const stats = useMemo(() => {
    const total = ACHIEVEMENT_CATALOG.length;
    let unlockedCount = 0;
    for (const def of ACHIEVEMENT_CATALOG) {
      if (earnedMap.has(def.id)) unlockedCount += 1;
    }
    const lockedCount = total - unlockedCount;
    const pct = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;
    const byRarity: Record<AchievementRarity, { total: number; locked: number; unlocked: number }> = {
      common: { total: 0, locked: 0, unlocked: 0 },
      rare: { total: 0, locked: 0, unlocked: 0 },
      epic: { total: 0, locked: 0, unlocked: 0 },
      legendary: { total: 0, locked: 0, unlocked: 0 },
      mythic: { total: 0, locked: 0, unlocked: 0 },
    };
    for (const def of ACHIEVEMENT_CATALOG) {
      byRarity[def.rarity].total += 1;
      if (earnedMap.has(def.id)) byRarity[def.rarity].unlocked += 1;
      else byRarity[def.rarity].locked += 1;
    }
    return { total, unlockedCount, lockedCount, pct, byRarity };
  }, [earnedMap]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ACHIEVEMENT_CATALOG.filter((def) => {
      const isUnlocked = earnedMap.has(def.id);
      if (view === 'locked' && isUnlocked) return false;
      if (view === 'unlocked' && !isUnlocked) return false;
      if (kind !== 'all' && def.kind !== kind) return false;
      if (rarity !== 'all' && def.rarity !== rarity) return false;
      if (!q) return true;
      return (
        def.name.toLowerCase().includes(q)
        || def.description.toLowerCase().includes(q)
        || def.howToUnlock.toLowerCase().includes(q)
        || def.rarity.includes(q)
        || def.id.includes(q)
      );
    });
  }, [earnedMap, view, kind, rarity, query]);

  const lockedGrouped = useMemo(() => {
    const groups: Partial<Record<AchievementRarity, AchievementDef[]>> = {};
    for (const def of filtered) {
      if (earnedMap.has(def.id)) continue;
      if (!groups[def.rarity]) groups[def.rarity] = [];
      groups[def.rarity]!.push(def);
    }
    // sort each group by difficulty then name
    const diffRank: Record<string, number> = {
      trivial: 0, easy: 1, medium: 2, hard: 3, legendary: 4, exclusive: 5,
    };
    for (const r of RARITY_ORDER) {
      groups[r]?.sort((a, b) => {
        const d = (diffRank[a.difficulty] ?? 0) - (diffRank[b.difficulty] ?? 0);
        return d !== 0 ? d : a.name.localeCompare(b.name);
      });
    }
    return groups;
  }, [filtered, earnedMap]);

  const unlockedList = useMemo(
    () => filtered.filter((d) => earnedMap.has(d.id)),
    [filtered, earnedMap],
  );

  const toggleGroup = (key: string) => {
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));
  };

  return (
    <div className={`ach-vault trophy-section ${compact ? '' : ''}`}>
      {/* Header + progress */}
      <header className="ach-vault__header">
        <div className="ach-vault__title-row">
          <div className="ach-vault__title">
            <span className="ach-vault__title-icon" aria-hidden>🏆</span>
            <div>
              <h3 className="ach-vault__heading">Trophy Vault</h3>
              <p className="ach-vault__sub">
                Track what you have — and what is still locked
              </p>
            </div>
          </div>
          <div className="ach-vault__progress-pill" title={`${stats.unlockedCount} of ${stats.total}`}>
            <span className="ach-vault__progress-num">{stats.unlockedCount}</span>
            <span className="ach-vault__progress-sep">/</span>
            <span className="ach-vault__progress-total">{stats.total}</span>
            <span className="ach-vault__progress-pct">{stats.pct}%</span>
          </div>
        </div>

        <div className="ach-vault__bar" role="progressbar" aria-valuenow={stats.pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="ach-vault__bar-fill" style={{ width: `${stats.pct}%` }} />
        </div>

        <div className="ach-vault__rarity-strip" aria-label="Progress by rarity">
          {RARITY_ORDER.map((r) => {
            const s = stats.byRarity[r];
            const p = s.total ? Math.round((s.unlocked / s.total) * 100) : 0;
            return (
              <button
                key={r}
                type="button"
                className={`ach-vault__rarity-chip ach-vault__rarity-chip--${r} ${rarity === r ? 'is-on' : ''}`}
                onClick={() => setRarity((cur) => (cur === r ? 'all' : r))}
                title={`${RARITY_META[r].label}: ${s.unlocked}/${s.total} unlocked`}
              >
                <span className="ach-vault__rarity-chip-label">{RARITY_META[r].label}</span>
                <span className="ach-vault__rarity-chip-count">{s.unlocked}/{s.total}</span>
                <span className="ach-vault__rarity-chip-bar">
                  <span style={{ width: `${p}%` }} />
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Controls */}
      <div className="ach-vault__controls">
        <div className="ach-vault__tabs" role="tablist" aria-label="Vault view">
          {(
            [
              { id: 'locked' as const, label: 'Locked', count: stats.lockedCount, icon: <Lock size={10} /> },
              { id: 'unlocked' as const, label: 'Unlocked', count: stats.unlockedCount, icon: <Sparkles size={10} /> },
              { id: 'all' as const, label: 'All', count: stats.total, icon: <Trophy size={10} /> },
            ]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={view === t.id}
              className={`ach-vault__tab ${view === t.id ? 'is-on' : ''}`}
              onClick={() => setView(t.id)}
            >
              {t.icon}
              {t.label}
              <span className="ach-vault__tab-count">{t.count}</span>
            </button>
          ))}
        </div>

        <div className="ach-vault__filters">
          <label className="ach-vault__search">
            <Search size={11} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, hint, rarity…"
              aria-label="Search trophies"
            />
          </label>
          <div className="ach-vault__kind" role="group" aria-label="Type filter">
            <Filter size={10} className="ach-vault__kind-icon" aria-hidden />
            {(
              [
                { id: 'all' as const, label: 'All types' },
                { id: 'achievement' as const, label: 'Achievements' },
                { id: 'award' as const, label: 'Awards' },
              ]
            ).map((k) => (
              <button
                key={k.id}
                type="button"
                className={`ach-vault__kind-btn ${kind === k.id ? 'is-on' : ''}`}
                onClick={() => setKind(k.id)}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Locked vault — structured by rarity */}
      {(view === 'locked' || view === 'all') && (
        <div className="ach-vault__body">
          {view === 'all' && unlockedList.length > 0 && (
            <section className="ach-vault__group">
              <button
                type="button"
                className="ach-vault__group-head ach-vault__group-head--unlocked"
                onClick={() => toggleGroup('unlocked')}
                aria-expanded={!collapsed.unlocked}
              >
                <span className="ach-vault__group-left">
                  <Sparkles size={12} />
                  <span className="ach-vault__group-title">Unlocked</span>
                  <span className="ach-vault__group-badge">{unlockedList.length}</span>
                </span>
                <ChevronDown
                  size={14}
                  className={`ach-vault__chevron ${collapsed.unlocked ? 'is-closed' : ''}`}
                />
              </button>
              {!collapsed.unlocked && (
                <div className="ach-vault__unlocked-grid trophy-section__row">
                  {unlockedList.map((def) => {
                    const earnedAt = earnedMap.get(def.id);
                    return (
                      <div
                        key={def.id}
                        tabIndex={0}
                        className={`${achievementBadgeClass(def, { unlocked: true, compact: true })} trophy-tip-host ach-vault__tile`}
                      >
                        <span className="ach-badge__icon text-[12px]">{def.icon}</span>
                        <span className="ach-badge__name text-[7px] leading-snug line-clamp-2 w-full break-words">
                          {def.name}
                        </span>
                        <span className="ach-badge__meta text-[6px]">{def.rarity}</span>
                        <TrophyTip def={def} unlocked earnedAt={earnedAt} />
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {RARITY_ORDER.map((r) => {
            const items = lockedGrouped[r];
            if (!items?.length) return null;
            const key = `locked-${r}`;
            const isClosed = collapsed[key];
            return (
              <section key={r} className={`ach-vault__group ach-vault__group--${r}`}>
                <button
                  type="button"
                  className={`ach-vault__group-head ach-vault__group-head--${r}`}
                  onClick={() => toggleGroup(key)}
                  aria-expanded={!isClosed}
                >
                  <span className="ach-vault__group-left">
                    <span className={`ach-vault__rarity-dot ach-vault__rarity-dot--${r}`} aria-hidden />
                    <Lock size={11} className="ach-vault__lock-ico" />
                    <span className="ach-vault__group-title">{RARITY_META[r].label} locked</span>
                    <span className="ach-vault__group-badge">{items.length}</span>
                  </span>
                  <ChevronDown
                    size={14}
                    className={`ach-vault__chevron ${isClosed ? 'is-closed' : ''}`}
                  />
                </button>
                {!isClosed && (
                  <ul className="ach-vault__list">
                    {items.map((def) => (
                      <li key={def.id}>
                        <LockedRow def={def} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          {view === 'locked' && filtered.length === 0 && (
            <EmptyState
              title={stats.lockedCount === 0 ? 'Vault cleared' : 'No matches'}
              body={
                stats.lockedCount === 0
                  ? 'Every trophy in the catalog is unlocked. Legend status.'
                  : 'Try another rarity, type, or search term.'
              }
            />
          )}
        </div>
      )}

      {/* Unlocked-only view */}
      {view === 'unlocked' && (
        <div className="ach-vault__body">
          {unlockedList.length === 0 ? (
            <EmptyState
              title="No unlocked trophies yet"
              body="Play the arcade, explore tabs, and complete challenges to fill your vault."
            />
          ) : (
            <div className="ach-vault__unlocked-grid trophy-section__row">
              {unlockedList.map((def) => {
                const earnedAt = earnedMap.get(def.id);
                return (
                  <div
                    key={def.id}
                    tabIndex={0}
                    className={`${achievementBadgeClass(def, { unlocked: true, compact: true })} trophy-tip-host ach-vault__tile`}
                  >
                    <span className="ach-badge__icon text-[12px]">{def.icon}</span>
                    <span className="ach-badge__name text-[7px] leading-snug line-clamp-2 w-full break-words">
                      {def.name}
                    </span>
                    <span className="ach-badge__meta text-[6px]">{def.rarity}</span>
                    <TrophyTip def={def} unlocked earnedAt={earnedAt} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LockedRow({ def }: { def: AchievementDef }) {
  return (
    <div
      tabIndex={0}
      className={`ach-vault__row ach-vault__row--${def.rarity} trophy-tip-host`}
    >
      <div className="ach-vault__row-icon" aria-hidden>
        <span className="ach-vault__row-emoji">{def.icon}</span>
        <span className="ach-vault__row-lock"><Lock size={9} /></span>
      </div>
      <div className="ach-vault__row-main min-w-0">
        <div className="ach-vault__row-top">
          <span className="ach-vault__row-name">{def.name}</span>
          <span className={`ach-vault__pill ach-vault__pill--${def.rarity}`}>
            {def.rarity}
          </span>
          <span className="ach-vault__pill ach-vault__pill--diff">
            {DIFFICULTY_LABELS[def.difficulty]}
          </span>
          <span className="ach-vault__pill ach-vault__pill--kind">
            {def.kind === 'award' ? 'Award' : 'Achievement'}
          </span>
        </div>
        <p className="ach-vault__row-hint">
          <span className="ach-vault__row-hint-label">How to unlock</span>
          {def.howToUnlock}
        </p>
      </div>
      <TrophyTip def={def} unlocked={false} />
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="ach-vault__empty">
      <div className="ach-vault__empty-icon" aria-hidden>🔐</div>
      <p className="ach-vault__empty-title">{title}</p>
      <p className="ach-vault__empty-body">{body}</p>
    </div>
  );
}
