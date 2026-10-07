@echo off
setlocal
echo After a DSH update: refreshing selectors, rebuilding, and redeploying...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -Update %*
echo.
pause
