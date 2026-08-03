# LUL Terminal — Full Backup Snapshot

| Feld | Wert |
|------|------|
| **ID** | `LUL-Terminal_FULL_2026-08-03_2215` |
| **Typ** | Komplett (Source + Runtime-Data + Secrets) |
| **Bundle** | `archives/FULL-BUNDLE.zip` |
| **Anleitung** | **[WIEDERHERSTELLUNG.md](./WIEDERHERSTELLUNG.md)** |

## Schnellstart

1. Lies **WIEDERHERSTELLUNG.md**
2. Entpacke `archives/FULL-BUNDLE.zip`
3. Code → Projektroot, `data/` → `data/`, `secrets/dotenv.env` → `.env`
4. `npm ci && npm run build && npm start` (oder PM2)

## Struktur

```
LUL-Terminal_FULL_2026-08-03_2215/
├── WIEDERHERSTELLUNG.md   ← deutsche Full-Restore-Anleitung
├── README.md
├── MANIFEST.txt
├── archives/
│   ├── FULL-BUNDLE.zip    ← alles in einem Archiv
│   ├── source.zip
│   ├── data.zip
│   └── secrets.zip
├── source/                ← entpackter Code
├── data/                  ← Runtime-Zustand
├── secrets/               ← .env, vault, admin, sqlite-Kopie
└── meta/                  ← git HEAD, hashes, versionen
```

## ⚠️ Secrets

Enthält Produktions-Secrets. Öffentliches Repo → rotieren oder privat halten.
