@echo off
setlocal enabledelayedexpansion

:: Check if mpv.exe exists in the current folder
if not exist "%~dp0mpv.exe" (
    echo ==========================================================
    echo  ERROR: mpv.exe was not found in this folder!
    echo  Make sure you place this script inside the same folder
    echo  where you extracted your mpv files.
    echo ==========================================================
    pause
    exit /b
)

echo Setting up MPV Protocol Handler...

:: 1. Create the batch script wrapper to strip 'mpv://' and run mpv.exe
(
echo @echo off
echo set "url=%%~1"
echo set "clean_url=%%url:mpv://=%%"
echo :: Fix browser stripping colons in "https://" or "http://"
echo set "clean_url=%%clean_url:https//=https://%%"
echo set "clean_url=%%clean_url:http//=http://%%"
echo start "" "%~dp0mpv.exe" "%%clean_url%%"
) > "%~dp0mpv-handler.bat"

:: 2. Write the registry keys under HKEY_CURRENT_USER (no Admin privileges required!)
reg add "HKCU\Software\Classes\mpv" /ve /t REG_SZ /d "URL:mpv Protocol" /f >nul
reg add "HKCU\Software\Classes\mpv" /v "URL Protocol" /t REG_SZ /d "" /f >nul
reg add "HKCU\Software\Classes\mpv\shell" /f >nul
reg add "HKCU\Software\Classes\mpv\shell\open" /f >nul
reg add "HKCU\Software\Classes\mpv\shell\open\command" /ve /t REG_SZ /d "\"%~dp0mpv-handler.bat\" \"%%1\"" /f >nul

echo ==========================================================
echo  SUCCESS: MPV Protocol Handler successfully registered!
echo  You can now close this window and play streams directly!
echo ==========================================================
pause
