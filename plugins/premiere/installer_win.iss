; RE-SRC Premiere Plugin Installer for Windows
; Build with Inno Setup (https://jrsoftware.org/isdl.php)

[Setup]
AppName=SFXFolder Premiere Plugin
AppVersion=1.0.4
AppPublisher=SFXFolder
AppPublisherURL=https://sfxfolder.com
DefaultDirName={userappdata}\Adobe\CEP\extensions\com.resrc.premiere
DisableDirPage=yes
DefaultGroupName=SFXFolder
OutputDir=.\dist
OutputBaseFilename=SFXFolder_Premiere_Setup
SetupIconFile=..\..\public\favicon.ico
Compression=lzma
SolidCompression=yes
PrivilegesRequired=none
CloseApplications=yes

[Files]
Source: ".\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion; Excludes: "installer_win.iss,install_mac.command,dist\*"

[Registry]
; Enable Debug Mode for CSXS (Adobe CEP) to allow unsigned extensions
; CSXS 10 (Premiere 2020)
Root: HKCU; Subkey: "Software\Adobe\CSXS.10"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"; Flags: uninsdeletevalue
; CSXS 11 (Premiere 2021/2022)
Root: HKCU; Subkey: "Software\Adobe\CSXS.11"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"; Flags: uninsdeletevalue
; CSXS 12 (Premiere 2023)
Root: HKCU; Subkey: "Software\Adobe\CSXS.12"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"; Flags: uninsdeletevalue
; CSXS 13 (Premiere 2024+)
Root: HKCU; Subkey: "Software\Adobe\CSXS.13"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"; Flags: uninsdeletevalue

[Icons]
Name: "{group}\Uninstall SFXFolder Plugin"; Filename: "{uninstallexe}"

[InstallDelete]
; Dọn dẹp cache cũ khi cài đè bản mới
Type: filesandordirs; Name: "{app}\cache"

[UninstallDelete]
; Xóa sạch thư mục khi gỡ
Type: filesandordirs; Name: "{app}"


[Messages]
FinishedHeadingLabel=Installation Complete!
FinishedLabel=SFXFolder has been installed. Please restart Premiere Pro and go to Window -> Extensions -> SFXFolder to start using the plugin.
