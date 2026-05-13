; -----------------------------------------------------------------------
; Inno Setup script — Noah Drive Sync (Vivason flavor)
;
; Build with :
;     "C:\Users\<you>\AppData\Local\Programs\Inno Setup 6\ISCC.exe" installer\setup.iss
;
; Or via build.py --installer  (which chains PyInstaller + ISCC).
; Output: dist\NoahDriveSyncSetup.exe — a single-file installer to ship
; to Vivason audios.
; -----------------------------------------------------------------------

#define AppName        "Noah Drive Sync"
#define AppVersion     "0.2.0"
#define AppPublisher   "Vivason"
#define AppExe         "NoahDriveSync.exe"
#define AppId          "{{8E2C3F4A-7B91-4D5C-A6E8-2F1B9C7D5E3A}"

[Setup]
AppId={#AppId}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL=https://www.vivason.fr/
DefaultDirName={autopf}\NoahDriveSync
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=NoahDriveSyncSetup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=..\assets\icon.ico
UninstallDisplayIcon={app}\{#AppExe}
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible
; Language matches the app : French.
ShowLanguageDialog=no

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Tasks]
Name: "desktopicon"; \
    Description: "Creer un raccourci sur le bureau"; \
    GroupDescription: "Raccourcis :"; \
    Flags: checkedonce
Name: "autostart"; \
    Description: "Lancer au demarrage de Windows (icone en barre des taches)"; \
    GroupDescription: "Demarrage :"; \
    Flags: checkedonce

[Files]
Source: "..\dist\{#AppExe}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; Start Menu (always created)
Name: "{commonprograms}\{#AppName}"; \
    Filename: "{app}\{#AppExe}"; \
    IconFilename: "{app}\{#AppExe}"
; Desktop (optional)
Name: "{commondesktop}\{#AppName}"; \
    Filename: "{app}\{#AppExe}"; \
    IconFilename: "{app}\{#AppExe}"; \
    Tasks: desktopicon
; Auto-start at user login (optional) — runs in tray mode
Name: "{userstartup}\{#AppName}"; \
    Filename: "{app}\{#AppExe}"; \
    Parameters: "tray"; \
    IconFilename: "{app}\{#AppExe}"; \
    Tasks: autostart

[Run]
; 1. Register the monthly scheduled task. /F overwrites if it already
;    exists (e.g. a previous install left it behind).
Filename: "schtasks"; \
    Parameters: "/Create /TN ""Noah Drive Sync"" /TR ""\""{app}\{#AppExe}\"" sync"" /SC MONTHLY /D 1 /ST 03:00 /F"; \
    Flags: runhidden waituntilterminated

; 2. Apply catch-up settings: StartWhenAvailable so a missed run (PC off
;    at 03:00 du 1er) se rattrape automatiquement quand le PC est dispo,
;    et autoriser le run sur batterie pour ne pas skipper sur laptop.
;    schtasks /Create ne sait pas regler ces flags — il faut PowerShell.
Filename: "powershell.exe"; \
    Parameters: "-NoProfile -ExecutionPolicy Bypass -Command ""$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 12); Set-ScheduledTask -TaskName 'Noah Drive Sync' -Settings $s | Out-Null"""; \
    Flags: runhidden waituntilterminated

; 3. Open the setup wizard right after install (unless silent install).
Filename: "{app}\{#AppExe}"; \
    Parameters: "setup"; \
    Description: "Configurer maintenant"; \
    Flags: postinstall nowait skipifsilent unchecked

[UninstallRun]
; Remove the scheduled task on uninstall. errorlevel 1 is OK (task absent).
Filename: "schtasks"; \
    Parameters: "/Delete /TN ""Noah Drive Sync"" /F"; \
    Flags: runhidden

[Code]
// Optional : warn the user that uninstall does NOT remove their config
// (keeps token + sync.log + encryption cache in %APPDATA% so a
// reinstall picks up where they left off).
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
    MsgBox(
      'La configuration utilisateur (compte Google, journal, cle de chiffrement) a ete conservee dans %APPDATA%\NoahDriveSync. Supprimez-la manuellement si besoin.',
      mbInformation, MB_OK
    );
end;
