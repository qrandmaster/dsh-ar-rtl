@echo off
setlocal
echo Installing the Arabic (RTL) plugin for the DSH Web GUI...
set "PS=powershell"
where pwsh >nul 2>nul && set "PS=pwsh"
%PS% -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
echo.
pause
