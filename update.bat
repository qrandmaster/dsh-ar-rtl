@echo off
setlocal
echo After a DSH update: refreshing selectors, rebuilding, and redeploying...
set "PS=powershell"
where pwsh >nul 2>nul && set "PS=pwsh"
%PS% -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -Update %*
echo.
pause
