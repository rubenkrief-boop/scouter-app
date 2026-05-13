# Noah Drive Sync

Outil desktop Windows qui sauvegarde le backup hebdomadaire Noah HIMSA vers
le Google Drive partagé Vivason, **une fois par mois**.

## Pourquoi

Noah crée un backup local sur le PC de chaque audioprothésiste. Si le PC
tombe en panne, la base patients est perdue. Cet outil copie automatiquement
le dernier backup vers le Drive partagé Vivason — chaque audio retrouve ses
données même en cas de sinistre.

## Comment ça marche

```
[Windows Task Scheduler — 1er du mois à 03:00]
       │
       ▼
[noah-drive-sync.exe]
   1. Trouve le dossier le plus récent dans
      C:\ProgramData\HIMSA\Noah\Backup\Database\
   2. Le zippe en mémoire (un seul fichier "noah-backup.zip")
   3. Upload sur Drive — le précédent est remplacé en place
   4. Logs locaux dans %APPDATA%\NoahDriveSync\sync.log
```

L'utilisateur choisit **au premier lancement** où sauvegarder :

| Mode | Destination | Pour qui |
|------|------------|----------|
| **Mon Drive personnel** *(défaut)* | `Mon Drive/Noah Backups/noah-backup.zip` | Démarrage immédiat, aucune action IT |
| **Drive partagé Vivason** | `<shared drive>/Noah Backups/<email>/noah-backup.zip` | Quand le shared Drive Vivason est prêt |

Le fichier dans Drive porte toujours le **même nom** (`noah-backup.zip`) et
est **mis à jour en place** chaque mois — Drive conserve le `fileId`, donc
toute URL partagée reste valable. La fraîcheur du backup se voit via la
métadonnée Drive `modifiedTime`.

## Installation (utilisateur)

1. Télécharge `NoahDriveSync.exe` depuis le lien envoyé par l'admin.
2. Double-clique pour lancer la première fois.
3. Connecte-toi avec ton compte Google Vivason.
4. Le planificateur de tâches Windows est créé automatiquement.
5. C'est fait. Aucune action mensuelle requise.

## Setup développeur

```bash
cd noah-drive-sync
python -m venv .venv
.venv\Scripts\activate     # Windows
pip install -e ".[dev]"

# Place credentials.json (Google Cloud OAuth credentials) à la racine
python -m noah_drive_sync          # run en mode CLI
python -m noah_drive_sync setup    # premier setup
```

## Stack

- Python 3.11+
- google-api-python-client (Drive API v3)
- Tkinter (UI first-run)
- PyInstaller (packaging .exe)
- Windows Task Scheduler (cron)

## Cible

Vivason — 100+ audioprothésistes. OAuth en mode "Internal" Workspace.
