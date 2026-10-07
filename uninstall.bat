@echo off
setlocal
echo Removing the Arabic (RTL) plugin from the DSH Web GUI...
set "PS=powershell"
where pwsh >nul 2>nul && set "PS=pwsh"
%PS% -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -Uninstall %*
echo.
pause
