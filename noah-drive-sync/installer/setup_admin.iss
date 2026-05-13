; -----------------------------------------------------------------------
; Inno Setup script — Noah Drive Sync ADMIN (master variant)
;
; A NE PAS DISTRIBUER AUX CLIENTS. Ce setup installe la version master
; qui inclut la commande `decrypt` + le bouton "Restaurer" dans l'UI.
;
; Build via :
;     python build.py --admin --installer
; Output: dist\NoahDriveSyncAdminSetup.exe
;
; Differences cle vs setup.iss client :
;   - AppId different (cohabitation des deux installs sur le poste editeur)
;   - Pas de tache planifiee monthly creee automatiquement (l'editeur
;     fait du decrypt a la demande, pas de sync automatique sur son PC)
;   - Pas d'auto-start au login (pas d'icone tray)
;   - Wizard de setup pas lance automatiquement post-install (l'editeur
;     n'a pas besoin d'un compte Google sync, il a juste besoin du fichier
;     admin-config.json deja en place)
; -----------------------------------------------------------------------

#define AppName        "Noah Drive Sync Admin"
#define AppVersion     "0.2.0"
#define AppPublisher   "Editeur Noah Drive Sync"
#define AppExe         "NoahDriveSyncAdmin.exe"
; AppId distinct du client pour permettre la cohabitation des deux
; installs sur le PC de l'editeur.
#define AppId          "{{B7D9A3E2-4F68-4A1B-9C5D-8E2F1A3B5C7D}"

[Setup]
AppId={#AppId}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\NoahDriveSyncAdmin
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=NoahDriveSyncAdminSetup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=..\assets\icon.ico
UninstallDisplayIcon={app}\{#AppExe}
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible
ShowLanguageDialog=no

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Tasks]
Name: "desktopicon"; \
    Description: "Creer un raccourci sur le bureau"; \
    GroupDescription: "Raccourcis :"; \
    Flags: checkedonce

[Files]
Source: "..\dist\{#AppExe}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{commonprograms}\{#AppName}"; \
    Filename: "{app}\{#AppExe}"; \
    IconFilename: "{app}\{#AppExe}"
Name: "{commondesktop}\{#AppName}"; \
    Filename: "{app}\{#AppExe}"; \
    IconFilename: "{app}\{#AppExe}"; \
    Tasks: desktopicon

; Pas de [Run] : la version admin n'a pas besoin de creer une tache
; planifiee, ni d'ouvrir un wizard automatique. L'editeur lance l'exe
; manuellement quand il a besoin de decrypter.

[Code]
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
    MsgBox(
      'La configuration admin (admin-config.json, decrypt-audit.log) a ete conservee dans %APPDATA%\NoahDriveSyncAdmin. Supprimez-la manuellement si besoin.',
      mbInformation, MB_OK
    );
end;
