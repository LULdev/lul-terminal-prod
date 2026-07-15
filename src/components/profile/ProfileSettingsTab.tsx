/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Eye,
  Gamepad2,
  Globe,
  Image as ImageIcon,
  KeyRound,
  Mail,
  Palette,
  Share2,
  Smile,
  Sparkles,
  Trash2,
  Upload,
  User,
  Zap,
} from 'lucide-react';
import { ACHIEVEMENT_BY_ID } from '../../data/achievements';
import { clampBirthdayDay } from '../../lib/profileCustomization';
import type { EarnedAchievement, SocialLink } from '../../data/achievements';
import { SOCIAL_PLATFORMS } from '../../data/achievements';
import { GAME_CATALOG } from '../../lib/gameCatalog';
import { safeAvatarUrl } from '../../lib/safeAvatarUrl';
import { safeCoverStyle } from '../../lib/safeCoverStyle';
import {
  ACCENT_THEMES,
  MOOD_OPTIONS,
  PROFILE_FRAMES,
  STATUS_PRESETS,
  type ProfileCustomization,
} from '../../types/profileCustomization';
import { ActionButton } from '../pages/PageShell';
import './profile.css';

type Props = {
  username: string;
  displayName: string;
  bio: string;
  website: string;
  email: string;
  password: string;
  avatarUrl: string;
  coverUrl: string;
  socialLinks: SocialLink[];
  customization: ProfileCustomization;
  achievements: EarnedAchievement[];
  avatarUploading: boolean;
  saving: boolean;
  error: string;
  success: React.ReactNode;
  onDisplayName: (v: string) => void;
  onBio: (v: string) => void;
  onWebsite: (v: string) => void;
  onEmail: (v: string) => void;
  onPassword: (v: string) => void;
  currentPassword: string;
  onCurrentPassword: (v: string) => void;
  onAvatarUrl: (v: string) => void;
  onCoverUrl: (v: string) => void;
  onSocialLinks: (l: SocialLink[]) => void;
  onCustomization: (c: ProfileCustomization) => void;
  onUploadAvatar: (f: File) => void;
  onSave: () => void;
  onDeleteAccount: (password: string) => Promise<void>;
  emailChanged?: boolean;
};

export function ProfileSettingsTab(props: Props) {
  const [openSection, setOpenSection] = useState<string>('identity');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const c = props.customization;
  const setC = (patch: Partial<ProfileCustomization>) => props.onCustomization({ ...c, ...patch });
  const setPrivacy = (patch: Partial<ProfileCustomization['privacy']>) =>
    props.onCustomization({ ...c, privacy: { ...c.privacy, ...patch } });
  const avatarSrc = safeAvatarUrl(props.avatarUrl, props.username);
  const coverStyle = safeCoverStyle(props.coverUrl);

  const sections = [
    { id: 'identity', label: 'Identity', icon: <User size={12} /> },
    { id: 'status', label: 'Status & vibe', icon: <Zap size={12} /> },
    { id: 'appearance', label: 'Look & feel', icon: <Palette size={12} /> },
    { id: 'social', label: 'Social', icon: <Share2 size={12} /> },
    { id: 'privacy', label: 'Privacy', icon: <Eye size={12} /> },
    { id: 'security', label: 'Security', icon: <KeyRound size={12} /> },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setOpenSection(s.id)}
            aria-current={openSection === s.id ? 'page' : undefined}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[8px] font-mono uppercase transition ${
              openSection === s.id ? 'profile-tab-active' : 'border-slate-800/80 text-slate-500 hover:border-slate-700'
            }`}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {openSection === 'identity' && (
        <SettingsCard title="Public identity">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Display name" value={props.displayName} onChange={props.onDisplayName} icon={<User size={11} />} />
            <Field label="Custom title" value={c.customTitle} onChange={(v) => setC({ customTitle: v })} placeholder="Coin Hunter" />
            <Field label="Tagline" value={c.tagline} onChange={(v) => setC({ tagline: v })} placeholder="Short headline under your name" span />
            <Field label="Bio" value={props.bio} onChange={(v) => props.onBio(v.slice(0, 160))} multiline span hint={`${props.bio.length}/160`} />
            <Field label="Pronouns" value={c.pronouns} onChange={(v) => setC({ pronouns: v })} placeholder="they/them" />
            <Field label="Location" value={c.location} onChange={(v) => setC({ location: v })} placeholder="Berlin, DE" />
            <Field label="Timezone" value={c.timezone} onChange={(v) => setC({ timezone: v })} placeholder="UTC+1" />
            <Field label="Website" value={props.website} onChange={props.onWebsite} icon={<Globe size={11} />} placeholder="https://…" />
            <div className="sm:col-span-2 grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[8px] font-mono uppercase text-slate-500">Birthday month</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={c.birthdayMonth ?? ''}
                  onChange={(e) => {
                    const month = e.target.value ? Number(e.target.value) : null;
                    setC({
                      birthdayMonth: month,
                      birthdayDay: clampBirthdayDay(month, c.birthdayDay),
                    });
                  }}
                  className={inputClass}
                  placeholder="1–12"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[8px] font-mono uppercase text-slate-500">Birthday day</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={c.birthdayDay ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value ? Number(e.target.value) : null;
                    setC({ birthdayDay: clampBirthdayDay(c.birthdayMonth, raw) });
                  }}
                  className={inputClass}
                  placeholder="1–31"
                />
              </label>
            </div>
          </div>
        </SettingsCard>
      )}

      {openSection === 'status' && (
        <SettingsCard title="Status & personality">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[8px] font-mono uppercase text-slate-500">Emoji</span>
                <input value={c.status.emoji} onChange={(e) => setC({ status: { ...c.status, emoji: e.target.value } })} className={`${inputClass} w-16 text-center text-lg`} maxLength={4} />
              </label>
              <Field label="Status message" value={c.status.text} onChange={(v) => setC({ status: { ...c.status, text: v } })} placeholder="What are you up to?" />
            </div>
            <div className="flex flex-wrap gap-1">
              {STATUS_PRESETS.map((p) => (
                <button
                  key={p.text}
                  type="button"
                  onClick={() => setC({ status: { text: p.text, emoji: p.emoji, updatedAt: Date.now() } })}
                  className="px-2 py-1 rounded-lg border border-slate-800/80 text-[8px] font-mono text-slate-400 hover:border-indigo-500/40 hover:text-indigo-200 transition"
                >
                  {p.emoji} {p.text.slice(0, 28)}{p.text.length > 28 ? '…' : ''}
                </button>
              ))}
            </div>
            <div>
              <span className="text-[8px] font-mono uppercase text-slate-500 block mb-1.5">Mood</span>
              <div className="flex flex-wrap gap-1">
                {MOOD_OPTIONS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setC({ mood: m.id })}
                    className={`px-2.5 py-1 rounded-lg border text-[8px] font-mono transition ${
                      c.mood === m.id ? 'profile-tab-active' : 'border-slate-800/80 text-slate-500'
                    }`}
                  >
                    {m.emoji} {m.label}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Vibe tag" value={c.vibeTag} onChange={(v) => setC({ vibeTag: v })} placeholder="lo-fi / synthwave / chaos" />
            <Field label="Ask me about" value={c.askMeAbout} onChange={(v) => setC({ askMeAbout: v })} placeholder="Arcade strats, memes, vault tips…" />
            <Field label="Fun fact" value={c.funFact} onChange={(v) => setC({ funFact: v })} multiline placeholder="Something quirky about you" />
            <label className="flex flex-col gap-1">
              <span className="text-[8px] font-mono uppercase text-slate-500 flex items-center gap-1"><Gamepad2 size={10} /> Favorite game</span>
              <select value={c.favoriteGame} onChange={(e) => setC({ favoriteGame: e.target.value })} className={inputClass}>
                <option value="">— none —</option>
                {GAME_CATALOG.map((g) => (
                  <option key={g.id} value={g.id}>{g.icon} {g.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[8px] font-mono uppercase text-slate-500 flex items-center gap-1"><Sparkles size={10} /> Featured trophy</span>
              <select value={c.featuredAchievementId} onChange={(e) => setC({ featuredAchievementId: e.target.value })} className={inputClass}>
                <option value="">— none —</option>
                {props.achievements.map((a) => {
                  const def = ACHIEVEMENT_BY_ID[a.id];
                  return <option key={a.id} value={a.id}>{def?.icon ?? '🏆'} {def?.name ?? a.id}</option>;
                })}
              </select>
            </label>
          </div>
        </SettingsCard>
      )}

      {openSection === 'appearance' && (
        <SettingsCard title="Look & feel">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-violet-500/30 bg-violet-500/10 text-[10px] font-mono text-violet-200 cursor-pointer hover:bg-violet-500/20 transition">
                <Upload size={12} />
                {props.avatarUploading ? 'Uploading…' : 'Upload avatar'}
                <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" disabled={props.avatarUploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) props.onUploadAvatar(f); e.target.value = ''; }} />
              </label>
              <span className="text-[9px] font-mono text-slate-600">max. 2 MB</span>
            </div>
            <Field label="Avatar URL" value={props.avatarUrl} onChange={props.onAvatarUrl} icon={<ImageIcon size={11} />} preview={<img src={avatarSrc} alt="" className="h-10 w-10 rounded-lg border border-slate-700 object-cover" />} />
            <Field label="Cover" value={props.coverUrl} onChange={props.onCoverUrl} hint="URL, gradient, CSS" preview={<div className="h-10 w-16 rounded-lg border border-slate-700 overflow-hidden" style={coverStyle} />} />
            <Field label="Favorite emoji" value={c.favoriteEmoji} onChange={(v) => setC({ favoriteEmoji: v })} icon={<Smile size={11} />} />
            <div>
              <span className="text-[8px] font-mono uppercase text-slate-500 block mb-1.5">Accent theme</span>
              <div className="flex flex-wrap gap-1.5">
                {ACCENT_THEMES.map((t) => (
                  <button key={t.id} type="button" onClick={() => setC({ accentTheme: t.id })} className={`px-2.5 py-1 rounded-lg border text-[8px] font-mono capitalize transition ${c.accentTheme === t.id ? 'profile-tab-active' : 'border-slate-800/80 text-slate-500'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[8px] font-mono uppercase text-slate-500 block mb-1.5">Avatar frame</span>
              <div className="flex flex-wrap gap-1.5">
                {PROFILE_FRAMES.map((f) => (
                  <button key={f.id} type="button" onClick={() => setC({ profileFrame: f.id })} className={`px-2.5 py-1 rounded-lg border text-[8px] font-mono transition ${c.profileFrame === f.id ? 'profile-tab-active' : 'border-slate-800/80 text-slate-500'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SettingsCard>
      )}

      {openSection === 'social' && (
        <SettingsCard title="Social links">
          <SocialEditor links={props.socialLinks} onChange={props.onSocialLinks} pinned={c.pinnedSocial} onPinned={(v) => setC({ pinnedSocial: v })} />
        </SettingsCard>
      )}

      {openSection === 'privacy' && (
        <SettingsCard title="Privacy controls">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Toggle label="Show email on profile" checked={c.privacy.showEmail} onChange={(v) => setPrivacy({ showEmail: v })} />
            <Toggle label="Show location" checked={c.privacy.showLocation} onChange={(v) => setPrivacy({ showLocation: v })} />
            <Toggle label="Show last seen" checked={c.privacy.showLastSeen} onChange={(v) => setPrivacy({ showLastSeen: v })} />
            <Toggle label="Show LULcoin balance" checked={c.privacy.showCoins} onChange={(v) => setPrivacy({ showCoins: v })} />
            <Toggle label="Show activity stats" checked={c.privacy.showActivityStats} onChange={(v) => setPrivacy({ showActivityStats: v })} />
          </div>
        </SettingsCard>
      )}

      {openSection === 'security' && (
        <SettingsCard title="Account security">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Email" value={props.email} onChange={props.onEmail} type="email" icon={<Mail size={11} />} />
            {(props.password || props.emailChanged) ? (
              <Field label="Current password" value={props.currentPassword} onChange={props.onCurrentPassword} type="password" icon={<KeyRound size={11} />} hint={props.password ? 'Required to set a new password' : 'Required to change email'} />
            ) : null}
            <Field label="New password" value={props.password} onChange={props.onPassword} type="password" icon={<KeyRound size={11} />} hint="Leave blank = unchanged" />
          </div>
        </SettingsCard>
      )}

      <div className="sticky bottom-0 z-10 profile-glass rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-h-[18px] text-[9px] font-mono">
          {props.error && <p className="text-rose-400">{props.error}</p>}
          {props.success && <p className="text-emerald-400">{props.success}</p>}
          {!props.error && !props.success && <p className="text-slate-600">Save to update your public profile</p>}
        </div>
        <ActionButton onClick={props.onSave} variant="indigo" disabled={props.saving}>
          {props.saving ? 'Saving…' : 'Save changes'}
        </ActionButton>
      </div>

      <div className="rounded-xl border border-rose-500/15 bg-rose-950/10 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h4 className="text-[10px] font-mono font-bold uppercase text-rose-300/90 flex items-center gap-1.5">
              <Trash2 size={11} /> Danger zone
            </h4>
            <p className="mt-1 text-[9px] font-mono text-slate-500">
              Permanently delete account and all sessions. Current password required.
            </p>
          </div>
          {!deleteOpen ? (
            <button
              type="button"
              onClick={() => {
                setDeleteOpen(true);
                setDeletePassword('');
                setDeleteError(null);
              }}
              className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-[10px] font-mono hover:bg-rose-500/20 transition"
            >
              <Trash2 size={12} /> Delete account
            </button>
          ) : null}
        </div>
        {deleteOpen && (
          <div className="mt-4 pt-4 border-t border-rose-500/10 space-y-3">
            <label className="block text-[9px] font-mono text-slate-500 uppercase tracking-wider">
              Confirm with password
            </label>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className={inputClass}
              placeholder="Current password"
              autoComplete="current-password"
            />
            {deleteError && <p className="text-[9px] font-mono text-rose-400">{deleteError}</p>}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={deleteBusy || !deletePassword}
                onClick={async () => {
                  setDeleteBusy(true);
                  setDeleteError(null);
                  try {
                    await props.onDeleteAccount(deletePassword);
                  } catch (e) {
                    setDeleteError(e instanceof Error ? e.message : 'Account deletion failed');
                  } finally {
                    setDeleteBusy(false);
                  }
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-500/40 bg-rose-500/20 text-rose-200 text-[10px] font-mono hover:bg-rose-500/30 transition disabled:opacity-50"
              >
                <Trash2 size={12} /> {deleteBusy ? 'Deleting…' : 'Confirm delete'}
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => {
                  setDeleteOpen(false);
                  setDeletePassword('');
                  setDeleteError(null);
                }}
                className="px-3 py-2 rounded-lg border border-slate-700 text-slate-400 text-[10px] font-mono hover:bg-slate-800/50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputClass =
  'w-full bg-[#0b0c10] border border-slate-800/80 rounded-lg px-3 py-2.5 text-[11px] font-mono text-slate-200 placeholder:text-slate-600 focus:border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition';

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="profile-glass rounded-2xl p-4">
      <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-300 mb-3">{title}</h4>
      {children}
    </div>
  );
}

function Field({
  label, value, onChange, type = 'text', icon, span, multiline, hint, placeholder, preview,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; icon?: React.ReactNode;
  span?: boolean; multiline?: boolean; hint?: string; placeholder?: string; preview?: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${span ? 'sm:col-span-2' : ''}`}>
      <div className="flex justify-between">
        <span className="flex items-center gap-1 text-[8px] font-mono uppercase text-slate-500">{icon}{label}</span>
        {hint && <span className="text-[8px] font-mono text-slate-600">{hint}</span>}
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          {multiline ? (
            <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={`${inputClass} resize-none`} placeholder={placeholder} />
          ) : (
            <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} placeholder={placeholder} />
          )}
        </div>
        {preview}
      </div>
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/60 bg-black/20 px-3 py-2 cursor-pointer">
      <span className="text-[9px] font-mono text-slate-400">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-indigo-500" />
    </label>
  );
}

function SocialEditor({
  links, onChange, pinned, onPinned,
}: {
  links: SocialLink[]; onChange: (l: SocialLink[]) => void; pinned: string; onPinned: (v: string) => void;
}) {
  const getUrl = (platform: string) => links.find((l) => l.platform === platform)?.url ?? '';
  const setUrl = (platform: string, url: string) => {
    const rest = links.filter((l) => l.platform !== platform);
    if (url.trim()) onChange([...rest, { platform, url: url.trim() }]);
    else {
      onChange(rest);
      if (pinned === platform) onPinned('');
    }
  };
  const activePlatforms = SOCIAL_PLATFORMS.filter((p) => getUrl(p.id).trim());

  return (
    <div className="space-y-3">
      {activePlatforms.length > 0 && (
        <label className="flex flex-col gap-1">
          <span className="text-[8px] font-mono uppercase text-slate-500">Pinned main link</span>
          <select value={pinned} onChange={(e) => onPinned(e.target.value)} className={inputClass}>
            <option value="">— none —</option>
            {activePlatforms.map((p) => <option key={p.id} value={p.id}>{p.icon} {p.label}</option>)}
          </select>
        </label>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {SOCIAL_PLATFORMS.map((p) => (
          <label key={p.id}>
            <span className="text-[8px] font-mono text-slate-500 uppercase flex items-center gap-1 mb-1">{p.icon} {p.label}</span>
            <input value={getUrl(p.id)} onChange={(e) => setUrl(p.id, e.target.value)} placeholder={p.placeholder} className={inputClass} />
          </label>
        ))}
      </div>
    </div>
  );
}