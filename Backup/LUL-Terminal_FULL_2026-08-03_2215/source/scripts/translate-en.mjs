/**
 * One-off script: translate German user-facing strings to English in listed files.
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');

const files = [
  'src/lib/auth.ts',
  'src/lib/analytics.ts',
  'src/lib/imageHosting.ts',
  'src/lib/premiumAccounts.ts',
  'src/lib/pageVisibility.ts',
  'src/lib/proxyChecker.ts',
  'src/lib/proxyScraper.ts',
  'src/lib/proxyDatabase.ts',
  'src/components/pages/ProfilePage.tsx',
  'src/components/pages/UserDashboardPage.tsx',
  'src/components/pages/InviteFriendsPage.tsx',
  'src/components/pages/MyActivityPage.tsx',
  'src/components/pages/FreePremiumAccountsPage.tsx',
  'src/components/pages/ImageHostingPage.tsx',
  'src/components/pages/MemeGeneratorPage.tsx',
  'src/components/pages/IdentityForgePage.tsx',
  'src/components/pages/ProxyDatabasePage.tsx',
  'src/components/pages/NetToolkitPage.tsx',
  'src/components/pages/TextLabPage.tsx',
  'src/components/pages/ChaosGeneratorPage.tsx',
  'src/components/pages/AdminDashboardPage.tsx',
  'src/components/pages/FAQPage.tsx',
  'src/components/image/MyImageGallery.tsx',
  'src/components/image/ImageHostingStatsBar.tsx',
  'src/components/meme/MemeEditor.tsx',
  'src/components/meme/MemeDatabaseStats.tsx',
  'src/components/news/NewsPanel.tsx',
  'src/components/diagnostics/EmoteMenuButton.tsx',
  'src/components/admin/AdminPageVisibilityPanel.tsx',
  'src/components/admin/AdminAnalyticsPanel.tsx',
  'src/components/admin/AdminNewsPanel.tsx',
  'src/components/admin/AdminProxyCheckerPanel.tsx',
  'src/components/admin/AdminProxyPipeline.tsx',
  'src/components/admin/AdminProxyScraperPanel.tsx',
  'src/components/admin/AdminCustomProxiesPanel.tsx',
];

// Order matters for overlapping patterns — longer strings first within each file
const replacements = [
  // lib/auth.ts
  ["'Datei konnte nicht gelesen werden'", "'Could not read file'"],
  // lib/analytics.ts
  ["'Aktivitätsdaten nicht verfügbar'", "'Activity data unavailable'"],
  ["'Aktive Benutzer nicht verfügbar'", "'Active users unavailable'"],
  ["'Analytics nicht verfügbar'", "'Analytics unavailable'"],
  ["'Benutzer-Aktivität nicht verfügbar'", "'User activity unavailable'"],
  ["'Benutzer nicht gefunden'", "'User not found'"],
  ["'Export fehlgeschlagen'", "'Export failed'"],
  ["'Purge fehlgeschlagen'", "'Purge failed'"],
  ["return 'gerade eben'", "return 'just now'"],
  ["return `vor ${Math.floor(diff / 60_000)} Min`", "return `${Math.floor(diff / 60_000)} min ago`"],
  ["return `vor ${Math.floor(diff / 3_600_000)} Std`", "return `${Math.floor(diff / 3_600_000)} hr ago`"],
  ["return new Date(ts).toLocaleString('de-DE')", "return new Date(ts).toLocaleString('en-US')"],
  // lib/imageHosting.ts
  ["'Nur Bilder (JPG, PNG, GIF, WebP, AVIF, BMP, SVG) erlaubt.'", "'Only images (JPG, PNG, GIF, WebP, AVIF, BMP, SVG) allowed.'"],
  ["`Maximal ${(MAX_IMAGE_BYTES / 1024 / 1024).toFixed(0)} MB pro Bild.`", "`Maximum ${(MAX_IMAGE_BYTES / 1024 / 1024).toFixed(0)} MB per image.`"],
  ["reject(new Error(body.error || 'Upload fehlgeschlagen'))", "reject(new Error(body.error || 'Upload failed'))"],
  ["reject(new Error('Ungültige Server-Antwort'))", "reject(new Error('Invalid server response'))"],
  ["reject(new Error('Server nicht erreichbar — npm run dev starten'))", "reject(new Error('Server unreachable — run npm run dev'))"],
  ["throw new Error('Bild konnte nicht geladen werden')", "throw new Error('Could not load image')"],
  ["throw new Error('Galerie nicht verfügbar')", "throw new Error('Gallery unavailable')"],
  ["throw new Error('Galerie-Statistiken nicht verfügbar')", "throw new Error('Gallery stats unavailable')"],
  ["throw new Error(body.error || 'Aktualisierung fehlgeschlagen')", "throw new Error(body.error || 'Update failed')"],
  ["throw new Error(body.error || 'Löschen fehlgeschlagen')", "throw new Error(body.error || 'Delete failed')"],
  ["() => reject(new Error('Datei konnte nicht gelesen werden'))", "() => reject(new Error('Could not read file'))"],
  // lib/premiumAccounts.ts
  ["throw new Error('Premium-Account-Stats nicht verfügbar')", "throw new Error('Premium account stats unavailable')"],
  ["throw new Error('Premium-Accounts nicht verfügbar')", "throw new Error('Premium accounts unavailable')"],
  ["throw new Error(err.error ?? 'Account konnte nicht gespeichert werden')", "throw new Error(err.error ?? 'Could not save account')"],
  ["|| err.message === 'Nicht angemeldet'", "|| err.message === 'Not logged in'"],
  ["throw new Error(err.error ?? 'Meldungen nicht verfügbar')", "throw new Error(err.error ?? 'Reports unavailable')"],
  ["throw new Error(err.error ?? 'Bestätigung fehlgeschlagen')", "throw new Error(err.error ?? 'Confirmation failed')"],
  ["throw new Error(err.error ?? 'Ablehnung fehlgeschlagen')", "throw new Error(err.error ?? 'Rejection failed')"],
  // lib/pageVisibility.ts
  ["throw new Error('Sichtbarkeit konnte nicht geladen werden')", "throw new Error('Could not load visibility')"],
  ["throw new Error('Admin-Sichtbarkeit nicht verfügbar')", "throw new Error('Admin visibility unavailable')"],
  ["throw new Error(body.error || 'Speichern fehlgeschlagen')", "throw new Error(body.error || 'Save failed')"],
  ["throw new Error(body.error || 'Reset fehlgeschlagen')", "throw new Error(body.error || 'Reset failed')"],
  // lib/proxyChecker.ts
  ["throw new Error('Checker-Stats nicht verfügbar')", "throw new Error('Checker stats unavailable')"],
  ["throw new Error(err.error ?? 'Check konnte nicht gestartet werden')", "throw new Error(err.error ?? 'Could not start check')"],
  ["throw new Error(data.error ?? 'Abbruch fehlgeschlagen')", "throw new Error(data.error ?? 'Cancel failed')"],
  ["throw new Error('Job nicht gefunden')", "throw new Error('Job not found')"],
  ["reject(new Error(job.error ?? 'Job fehlgeschlagen'))", "reject(new Error(job.error ?? 'Job failed'))"],
  // lib/proxyScraper.ts
  ["throw new Error('Stats nicht verfügbar')", "throw new Error('Stats unavailable')"],
  ["throw new Error(data.error ?? 'Proxies konnten nicht gespeichert werden')", "throw new Error(data.error ?? 'Could not save proxies')"],
  ["throw new Error(data.error ?? 'Löschen fehlgeschlagen')", "throw new Error(data.error ?? 'Delete failed')"],
  ["throw new Error(data.error ?? 'Leeren fehlgeschlagen')", "throw new Error(data.error ?? 'Clear failed')"],
  ["throw new Error(err.error ?? 'Scrape konnte nicht gestartet werden')", "throw new Error(err.error ?? 'Could not start scrape')"],
  ["throw new Error(data.error ?? 'Quelle konnte nicht gespeichert werden')", "throw new Error(data.error ?? 'Could not save source')"],
  ["throw new Error(err.error ?? 'Job konnte nicht gestartet werden')", "throw new Error(err.error ?? 'Could not start job')"],
  ["reject(new Error(job.error ?? 'Job fehlgeschlagen'))", "reject(new Error(job.error ?? 'Job failed'))"],
  // lib/proxyDatabase.ts
  ["throw new Error('Proxy-Datenbank Stats nicht verfügbar')", "throw new Error('Proxy database stats unavailable')"],
  ["throw new Error('Proxy-Listen nicht verfügbar')", "throw new Error('Proxy lists unavailable')"],
  ["throw new Error(err.error ?? 'Daily-Check fehlgeschlagen')", "throw new Error(err.error ?? 'Daily check failed')"],
  // Locale swaps in listed UI files
  [".toLocaleString('de-DE')", ".toLocaleString('en-US')"],
  [".toLocaleDateString('de-DE')", ".toLocaleDateString('en-US')"],
  [".toLocaleString('de-DE',", ".toLocaleString('en-US',"],
  [".toLocaleDateString('de-DE',", ".toLocaleDateString('en-US',"],
];

// File-specific replacements (applied only to matching file basename)
const fileSpecific = {
  'ProfilePage.tsx': [
    ["'Profil nicht gefunden'", "'Profile not found'"],
    ['title="Profil"', 'title="Profile"'],
    ['subtitle="Profil-URL: /profile/benutzername"', 'subtitle="Profile URL: /profile/username"'],
    ['Kein Benutzername in der URL.', 'No username in the URL.'],
    ["'Profil gespeichert'", "'Profile saved'"],
    ["'Speichern fehlgeschlagen'", "'Failed to save'"],
    ["'Avatar hochgeladen'", "'Avatar uploaded'"],
    ["'Upload fehlgeschlagen'", "'Upload failed'"],
    ["confirm('Konto wirklich löschen? Dies kann nicht rückgängig gemacht werden.')", "confirm('Really delete account? This cannot be undone.')"],
    ['label="Mitglied seit"', 'label="Member since"'],
    ['label="Letzter Login"', 'label="Last login"'],
    ['label="Profilaufrufe"', 'label="Profile views"'],
    ['label="Geworbene Mitglieder"', 'label="Referred members"'],
    ['label="E-Mail"', 'label="Email"'],
    ['title="Berechtigungen"', 'title="Permissions"'],
    ['label="Accounts einreichen"', 'label="Submit accounts"'],
    ['label="Verifiziert"', 'label="Verified"'],
    ['<span className="text-[10px] font-semibold">VIP aktiv</span>', '<span className="text-[10px] font-semibold">VIP active</span>'],
    ['Premium Accounts und exklusive Bereiche freigeschaltet.', 'Premium accounts and exclusive areas unlocked.'],
    ['<LogOut size={12} /> Abmelden', '<LogOut size={12} /> Log out'],
    ['title="Öffentliches Profil"', 'title="Public profile"'],
    ['label="Anzeigename"', 'label="Display name"'],
    ['placeholder="https://deine-seite.de"', 'placeholder="https://your-site.com"'],
    ['label="Kurz-Bio"', 'label="Short bio"'],
    ['title="Erscheinungsbild"', 'title="Appearance"'],
    ["{avatarUploading ? 'Lädt…' : 'Avatar hochladen'}", "{avatarUploading ? 'Loading…' : 'Upload avatar'}"],
    ['label="Titelbild"', 'label="Cover image"'],
    ['hint="URL, Gradient oder CSS"', 'hint="URL, gradient, or CSS"'],
    ['title="Sicherheit"', 'title="Security"'],
    ['label="Neues Passwort"', 'label="New password"'],
    ['hint="Leer lassen = unverändert"', 'hint="Leave blank = unchanged"'],
    ['Änderungen werden sofort übernommen', 'Changes apply immediately'],
    ["{saving ? 'Speichern…' : 'Änderungen speichern'}", "{saving ? 'Saving…' : 'Save changes'}"],
    ['<Trash2 size={11} /> Gefahrenzone', '<Trash2 size={11} /> Danger zone'],
    ['Konto und alle Sessions permanent löschen.', 'Permanently delete account and all sessions.'],
    ['<Trash2 size={12} /> Konto löschen', '<Trash2 size={12} /> Delete account'],
    ['Profil wird geladen…', 'Loading profile…'],
    ['subtitle={`@${profile.username} · Öffentliches Profil`}', 'subtitle={`@${profile.username} · Public profile`}'],
    ['Eigenes Profil bearbeiten?', 'Edit your own profile?'],
    ['<ActionButton onClick={onLogin} variant="indigo">Anmelden</ActionButton>', '<ActionButton onClick={onLogin} variant="indigo">Log in</ActionButton>'],
    ['Premium Vault — eingereichte Accounts', 'Premium Vault — submitted accounts'],
    ['Aktivität & Moderation', 'Activity & moderation'],
    ['Verwarnungen missbräuchliche Button-Benutzung', 'Abuse warnings (report button misuse)'],
    ['Shoutbox-Nachrichten', 'Shoutbox messages'],
    ['bestätigt {formatDate(a.acceptedAt)}', 'confirmed {formatDate(a.acceptedAt)}'],
    ['Von der Community gemeldet und vom Admin als nicht funktionierend bestätigt.', 'Reported by the community and confirmed as not working by an admin.'],
    ["{copied ? <><Check size={10} /> Kopiert</> : <><Copy size={10} /> Kopieren</>}", "{copied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}"],
    ["{active ? 'Aktiv' : '—'}", "{active ? 'Active' : '—'}"],
  ],
  'UserDashboardPage.tsx': [
    ["return 'heute'", "return 'today'"],
    ["return `vor ${Math.floor(diff / 86_400_000)} Tagen`", "return `${Math.floor(diff / 86_400_000)} days ago`"],
    ["setMsg(password ? 'E-Mail & Passwort aktualisiert' : 'E-Mail aktualisiert')", "setMsg(password ? 'Email & password updated' : 'Email updated')"],
    ["'Speichern fehlgeschlagen'", "'Failed to save'"],
    ['subtitle="Dein LUL Terminal"', 'subtitle="Your LUL Terminal"'],
    ['title="Willkommen"', 'title="Welcome"'],
    ['Melde dich an oder registriere dich — danach landest du hier mit Stats, Achievements und Einstellungen.', 'Log in or register — then you land here with stats, achievements, and settings.'],
    ['<ActionButton onClick={() => openAuth(\'login\')} variant="indigo">Anmelden</ActionButton>', '<ActionButton onClick={() => openAuth(\'login\')} variant="indigo">Log in</ActionButton>'],
    ['Registrieren', 'Register'],
    ['subtitle={`Willkommen, ${user.displayName}`}', 'subtitle={`Welcome, ${user.displayName}`}'],
    ['Mitglied seit {formatDate(user.createdAt)}', 'Member since {formatDate(user.createdAt)}'],
    ['Letzter Login: {formatDate(user.lastLoginAt)}', 'Last login: {formatDate(user.lastLoginAt)}'],
    ['<User size={11} /> Profil', '<User size={11} /> Profile'],
    ['label="Profilaufrufe"', 'label="Profile views"'],
    ['label="Eingereicht"', 'label="Submitted"'],
    ['label="Seiten"', 'label="Pages"'],
    ['label="Befehle"', 'label="Commands"'],
    ['title="Sicherheit"', 'title="Security"'],
    ['E-Mail und Passwort — Profil & Avatar unter „Profil".', 'Email and password — profile & avatar under "Profile".'],
    ['<Mail size={10} className="inline mr-1" /> E-Mail', '<Mail size={10} className="inline mr-1" /> Email'],
    ['Neues Passwort (optional)', 'New password (optional)'],
    ['placeholder="Leer lassen = unverändert"', 'placeholder="Leave blank = unchanged"'],
    ["{saving ? 'Speichert…' : 'Speichern'}", "{saving ? 'Saving…' : 'Save'}"],
    ['title="Schnellzugriff"', 'title="Quick links"'],
    ['label="Profil bearbeiten"', 'label="Edit profile"'],
    ['label="Meine Aktivität"', 'label="My activity"'],
    ['label="Freunde einladen"', 'label="Invite friends"'],
    ['Dein Invite-Link', 'Your invite link'],
    ['title="Berechtigungen"', 'title="Permissions"'],
    ['label="Premium ansehen"', 'label="View premium"'],
    ['label="Accounts einreichen"', 'label="Submit accounts"'],
    ['label="Verifiziert"', 'label="Verified"'],
    ['title="Konto"', 'title="Account"'],
    ['Registriert {formatDate(user.createdAt)}', 'Registered {formatDate(user.createdAt)}'],
    ['<LogOut size={11} /> Abmelden', '<LogOut size={11} /> Log out'],
    ['title="Zuletzt freigeschaltet"', 'title="Recently unlocked"'],
    ['Noch keine Achievements — erkunde Tabs, Terminal & Tools!', 'No achievements yet — explore tabs, terminal & tools!'],
    ['Alle Achievements im Profil', 'All achievements on profile'],
  ],
  'InviteFriendsPage.tsx': [
    ["'Einladungsdaten nicht verfügbar'", "'Invite data unavailable'"],
    ["'Kopieren fehlgeschlagen — Text manuell markieren'", "'Copy failed — select text manually'"],
    ['subtitle="Freunde einladen · Referral-Link · Mitglieder werben"', 'subtitle="Invite friends · referral link · grow members"'],
    ['Einladungen nur mit Account', 'Invites require an account'],
    ['Melde dich an, um deinen persönlichen Einladungslink zu erhalten und geworbene Mitglieder zu tracken.', 'Log in to get your personal invite link and track referred members.'],
    ['<LogIn size={14} /> Anmelden', '<LogIn size={14} /> Log in'],
    ['subtitle="Teile deinen Link — neue Mitglieder werden deinem Profil gutgeschrieben"', 'subtitle="Share your link — new members are credited to your profile"'],
    ['Dein Einladungslink', 'Your invite link'],
    ['Jeder, der sich über deinen Link registriert, zählt als geworbenes Mitglied. Der Code wird beim Registrieren automatisch übernommen.', 'Anyone who registers via your link counts as a referred member. The code is applied automatically at registration.'],
    ['Geworbene Mitglieder', 'Referred members'],
    ['Dein Code', 'Your code'],
    ['<Link2 size={10} /> Einladungs-URL', '<Link2 size={10} /> Invite URL'],
    ["value={loading ? 'Lade…' : inviteUrl}", "value={loading ? 'Loading…' : inviteUrl}"],
    ["So funktioniert&apos;s", "How it works"],
    ['Link kopieren und an Freunde senden (Discord, WhatsApp, …).', 'Copy the link and send it to friends (Discord, WhatsApp, …).'],
    ['Freund öffnet den Link — der Code wird gespeichert.', 'Friend opens the link — the code is saved.'],
    ['Bei der Registrierung wird der Code automatisch angewendet.', 'The code is applied automatically during registration.'],
    ['Dein Profil zeigt die Anzahl geworbener Mitglieder.', 'Your profile shows the number of referred members.'],
  ],
  'MyActivityPage.tsx': [
    ["'Laden fehlgeschlagen'", "'Failed to load'"],
    ['title="Meine Aktivität"', 'title="My Activity"'],
    ['subtitle="Persönliche Nutzungsstatistiken"', 'subtitle="Personal usage statistics"'],
    ['title="Anmeldung erforderlich"', 'title="Login required"'],
    ['Melde dich an, um deine persönlichen Nutzungsstatistiken zu sehen.', 'Log in to see your personal usage statistics.'],
    ['<ActionButton onClick={() => openAuth(\'login\')} variant="indigo">Anmelden</ActionButton>', '<ActionButton onClick={() => openAuth(\'login\')} variant="indigo">Log in</ActionButton>'],
    ['subtitle="Privat · Lokale Statistiken"', 'subtitle="Private · local statistics"'],
    ["{loading && <p className=\"text-[10px] font-mono text-slate-600\">lädt…</p>}", "{loading && <p className=\"text-[10px] font-mono text-slate-600\">loading…</p>}"],
    ['label="Seitenbesuche"', 'label="Page visits"'],
    ['label="Befehle"', 'label="Commands"'],
    ['label="Online (Min)"', 'label="Online (min)"'],
    ['label="Profilbesuche"', 'label="Profile visits"'],
    ['title="Besuchte Bereiche"', 'title="Visited areas"'],
    ['Noch keine Tabs erfasst', 'No tabs recorded yet'],
    ['title="Profil-Metriken"', 'title="Profile metrics"'],
    ['<span className="text-slate-600">Profilaufrufe</span>', '<span className="text-slate-600">Profile views</span>'],
    ['title="Letzte Aktivität"', 'title="Recent activity"'],
  ],
};

let modified = [];

for (const rel of files) {
  const fp = path.join(root, rel);
  if (!fs.existsSync(fp)) {
    console.warn('SKIP missing:', rel);
    continue;
  }
  let content = fs.readFileSync(fp, 'utf8');
  const original = content;
  const base = path.basename(rel);

  for (const [from, to] of replacements) {
    if (content.includes(from)) content = content.split(from).join(to);
  }
  if (fileSpecific[base]) {
    for (const [from, to] of fileSpecific[base]) {
      if (content.includes(from)) content = content.split(from).join(to);
    }
  }

  if (content !== original) {
    fs.writeFileSync(fp, content, 'utf8');
    modified.push(rel);
    console.log('OK', rel);
  }
}

console.log('\nModified', modified.length, 'files');