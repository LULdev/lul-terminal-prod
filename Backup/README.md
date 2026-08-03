# LUL Terminal — Backup-Index

Zentrale Backup-Ablage im Repository.

## Aktuelles Full-Backup

| Snapshot | Beschreibung |
|----------|----------------|
| **[LUL-Terminal_FULL_2026-08-03_2215](./LUL-Terminal_FULL_2026-08-03_2215/)** | Komplett: Source + `data/` + Secrets + SHA256 + **[WIEDERHERSTELLUNG.md](./LUL-Terminal_FULL_2026-08-03_2215/WIEDERHERSTELLUNG.md)** |

### One-Click Bundle

`LUL-Terminal_FULL_2026-08-03_2215/archives/FULL-BUNDLE.zip`

### Wiederherstellung (Kurz)

Siehe ausführlich: [WIEDERHERSTELLUNG.md](./LUL-Terminal_FULL_2026-08-03_2215/WIEDERHERSTELLUNG.md)

```bash
# Beispiel Linux
unzip archives/FULL-BUNDLE.zip -d restore-tmp
cp -a restore-tmp/source/. /opt/lul-terminal/
cp -a restore-tmp/data/. /opt/lul-terminal/data/
cp restore-tmp/secrets/dotenv.env /opt/lul-terminal/.env
cd /opt/lul-terminal && npm ci && npm run build && pm2 restart lul-terminal
```

## Sicherheit

- Backups können **Passwörter, Session-DB und Vault-Keys** enthalten.
- Repo ist ggf. **öffentlich** — nach Upload Secrets rotieren oder Backup nur privat speichern.
- `node_modules` und `dist` sind nicht im Backup (immer neu bauen).

## Neues Backup erzeugen (Dev)

```powershell
# PowerShell im Repo-Root (lul-terminal)
# (Skript kann bei Bedarf ergänzt werden — manuell wie dieses Snapshot-Layout)
```

## GitHub

Dieses Verzeichnis wird mit dem Repo gepusht (`origin/main`), damit ein vollständiger Stand + Anleitung remote liegt.
