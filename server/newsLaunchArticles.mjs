/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Launch copy upserted into LUL Wire if the article id is missing.
 * Bodies must stay under newsStore's 8000-character cap.
 */

export const BYPASS_LAUNCH_ARTICLE = {
  id: 'feat-bypass',
  category: 'FEATURE LAUNCH',
  icon: '🔓',
  highlight: true,
  publishedAt: '2026-08-21T12:00:00.000Z',
  authorId: 'system',
  authorName: 'LUL Wire',
  title: 'Bypass ist da: Linkvertise, Shortener und Pastes in einem Klick',
  body: `Bypass ist ab sofort im Hauptmenü von LUL Terminal. Das neue Modul holt für angemeldete Mitglieder das eigentliche Ziel hinter Linkvertise, Shortenern, Unlock-Seiten und Paste-Hosts — ohne Werbung, ohne Countdown, ohne Klickkette.

Wer in Foren, Discords oder Release-Threads unterwegs ist, kennt das Muster. Statt einer direkten Adresse kommt zuerst ein Locker. Linkvertise und die dazugehörigen Domains schalten Werbung, zählen Sekunden herunter und verlangen oft extra Schritte, bevor die echte URL erscheint. Shortener wie bit.ly oder t.co verstecken das Ziel hinter einer Weiterleitung. Paste-Seiten packen den Link in einen Textblock, den man erst öffnen, scrollen und heraussuchen muss. Bypass nimmt genau diese URLs entgegen und liefert die Destination in einem Schritt.

Öffnen geht über den Menüpunkt Bypass (🔓) oder direkt über /?tab=bypass. Das Modul ist nur für registrierte, aktive Mitglieder. Gäste sehen die Anmeldesperre. Auch wenn ein Admin den Tab später öffentlich schaltet, bleibt die Schnittstelle hinter einer Session: ohne Login wird nichts aufgelöst. Das schützt den Server und hält den Dienst in der Community.

Die Bedienung ist absichtlich kurz. Eine URL ins Feld, dann Bypass oder Strg bzw. Befehlstaste plus Enter. Darunter erscheint das Ergebnis: die Zieladresse zum Kopieren, ein Open-Button für einen neuen Tab, bei Paste-Inhalten zusätzlich der Klartext. Mehrere Links funktionieren zeilenweise, höchstens acht auf einmal. Anführungszeichen, spitze Klammern oder ein fehlendes https werden beim Einfügen weggeräumt. Erkannte Dienste zeigt ein Chip — etwa Linkvertise, Work.ink oder Pastebin. Die letzten zwanzig Auflösungen bleiben lokal im Browser, nicht auf dem Server. Ein Klick im Verlauf setzt die Original-URL wieder ein, ohne dass jemand eure Ziele mitliest.

Zwei Ergebnisarten sind wichtig. Bei einem normalen Unlock steht die Destination groß da: kopieren oder öffnen. Bei einem Paste ohne extrahierbare URL gibt es den Text selbst — Bypass zeigt dann nicht fälschlich die Paste-Seite als „Ziel“. Sitzt in dem Paste wiederum ein Link, versucht das Modul den nächsten Hop. So bleibt die Kette kurz, auch wenn jemand Locker und Paste hintereinander gestapelt hat.

Höchste Priorität hat Linkvertise. Bypass kennt die gängigen Domains: linkvertise.com, linkvertise.net, link-to.net, linkvertise.download, direct-link.net, up-to-down.net, file-link.net, link-center.net, link-target.net, link-hub.net, lvturbo.com und linkvertise.io. Der Resolver spricht die Publisher-API, versteht Paste-Typ und verschachtelte Locker und fällt nicht auf Werbelandungen herein. Wer einen klassischen Linkvertise-Link einfügt, soll das echte Ziel sehen — nicht den nächsten Ad-Tab.

Danach folgen weitere Lockers und Unlock-Seiten: Work.ink, Lootlabs, AdFoc.us, AdMaven, Boost.ink, Bstlar, Rekonise, Social Unlock, Sub2Unlock und verwandte Hosts. Shortener sind abgedeckt, darunter bit.ly, t.co, TinyURL, is.gd, t.ly, Rebrandly und Cuttly. Bei Pastes liest Bypass unter anderem Pastebin, Rentry, Hastebin, JustPaste, ControlC, Telegraph und weitere Paste-Hosts. Die aktuelle Liste steht auf der Seite selbst und lässt sich filtern. Nicht jede Website der Welt ist dabei — Bezahlschranken, Logins und beliebige Shop-Seiten gehören nicht zum Auftrag.

Technisch arbeitet Bypass in einer Hop-Kette statt mit einem einzigen Trick. Zuerst prüft er Ziel-Parameter in der URL, etwa bei Google /url?q=. Dann kommen dienstspezifische Resolver. Linkvertise läuft über die Publisher-API, nicht über das Scraping der Werbelandung. Shortener werden über echte HTTP-Redirects verfolgt. Pastes gehen über Raw-Endpunkte; eine HTML-Hülle der Paste-Seite wird nicht als Zieltext missverstanden. Öffentliche Bypass-APIs sind nur Fallback, wenn der eigene Weg nichts liefert. Jede Destination muss öffentlich und http oder https sein. Private Netze, Loopback, Link-Local und IPv6-Loopback fallen raus. Ein Locker gilt nie als Erfolg — außer der Inhalt ist wirklich Paste-Text. Der Open-Button im Browser prüft dasselbe noch einmal, bevor etwas geöffnet wird.

Komfort war von Anfang an Teil der Spezifikation. Keine Popups, keine Timer, kein manuelles Durchklicken. Mehrere Treffer lassen sich auf einmal kopieren. Der Verlauf speichert die Original-Locker-URL, nicht eure Ziele auf dem Server. Wer eine Anfrage abbricht oder die Seite wechselt, stoppt auch die ausgehenden Hops. Rate-Limits begrenzen den Durchsatz, damit der Dienst für alle nutzbar bleibt.

Wenn etwas scheitert, bleibt die Karte ehrlich: Failed statt einer Werbe-URL. Zu viele Anfragen in kurzer Zeit geben eine Wartezeit. Nicht eingeloggt heißt schlicht: zuerst anmelden. Die unterstützten Dienste liegen in einer filterbaren Liste unter dem Eingabefeld — zum Nachschlagen, nicht als Pflichtlektüre vor dem ersten Klick.

Bypass ist kein universeller Türöffner. Er löst die Lockers, Shortener und Pastes, die in der Liste stehen, mit klarem Fokus auf Linkvertise. Er umgeht keine Paywalls, keine Accounts und keine Captchas hinter Login. Wenn ein Dienst das Ziel gar nicht ausliefert oder die Kette in einem Locker stecken bleibt, zeigt die Karte einen Fehler statt einer erfundenen Adresse.

Kurz: Link einfügen, einmal bestätigen, Ziel kopieren oder öffnen. FAQ erklärt die Kurzfragen, das Change Log die Versionen. Direkt starten: /?tab=bypass`,
};
