@echo off
setlocal
pwsh.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy.ps1" -Destination "%~1"
exit /b %errorlevel%
