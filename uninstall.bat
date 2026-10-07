@echo off
setlocal
echo Removing the Arabic (RTL) plugin from the DSH Web GUI...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -Uninstall %*
echo.
pause
