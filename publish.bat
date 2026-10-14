@echo off
setlocal
call "%~dp0dev.bat" install --frozen-lockfile
if not "%errorlevel%"=="0" exit /b %errorlevel%
call "%~dp0dev.bat" run dist
exit /b %errorlevel%
