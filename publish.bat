@echo off
setlocal
call "%~dp0dev.bat" run dist
exit /b %errorlevel%
