@echo off
setlocal
echo Installing the Arabic (RTL) plugin for the DSH Web GUI...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
echo.
pause
