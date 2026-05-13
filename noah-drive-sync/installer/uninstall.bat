@echo off
REM Removes the scheduled task. Does NOT delete the .exe nor the local
REM config (%APPDATA%\NoahDriveSync\). Re-run install_task.bat to restore.

schtasks /Delete /TN "Noah Drive Sync" /F

if errorlevel 1 (
  echo [INFO] Aucune tache "Noah Drive Sync" trouvee — rien a faire.
) else (
  echo [OK] Tache supprimee.
)
pause
