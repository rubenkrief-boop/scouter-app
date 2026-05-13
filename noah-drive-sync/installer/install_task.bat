@echo off
REM ============================================================
REM Noah Drive Sync — register the monthly Windows scheduled task
REM
REM Run once after copying NoahDriveSync.exe somewhere stable
REM (e.g. C:\Program Files\NoahDriveSync\). Place this .bat next
REM to the .exe and double-click it.
REM ============================================================

setlocal

set "EXE=%~dp0NoahDriveSync.exe"

if not exist "%EXE%" (
  echo [ERREUR] NoahDriveSync.exe introuvable a cote de ce script :
  echo    %EXE%
  pause
  exit /b 1
)

echo Enregistrement de la tache planifiee...

schtasks /Create ^
  /TN "Noah Drive Sync" ^
  /TR "\"%EXE%\" sync" ^
  /SC MONTHLY ^
  /D 1 ^
  /ST 03:00 ^
  /F

if errorlevel 1 (
  echo [ERREUR] La creation de la tache a echoue. Lancez ce script en
  echo administrateur si la tache doit s'executer pour tous les comptes.
  pause
  exit /b 1
)

REM Apply catch-up settings (PC off at 03:00 -> sync at next boot/login)
REM and allow running on battery. schtasks ne sait pas regler ces flags.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 12); Set-ScheduledTask -TaskName 'Noah Drive Sync' -Settings $s | Out-Null"

if errorlevel 1 (
  echo [ATTENTION] Reglages avances de la tache non appliques. La tache
  echo de base est creee mais ne se rattrapera pas si le PC est eteint
  echo le 1er du mois. Relancez ce script en administrateur si besoin.
)

echo.
echo [OK] La tache "Noah Drive Sync" sera lancee tous les 1ers du mois a 03:00.
echo     (rattrapage automatique si le PC etait eteint a cet instant)
echo.
echo Lancement immediat de la configuration (vous allez vous connecter avec
echo votre compte Google Vivason)...
echo.
"%EXE%" setup

endlocal
