@echo off
setlocal
pushd "%~dp0"
if not exist "%~dp0.tools\environment.bat" goto missing
call "%~dp0.tools\environment.bat"
if not exist "%APPDOCK_NODE_DIR%\node.exe" goto missing
if not exist "%APPDOCK_PNPM_DIR%\pnpm.cmd" goto missing
set "PATH=%APPDOCK_NODE_DIR%;%APPDOCK_PNPM_DIR%;%PATH%"
set "npm_config_cache=%~dp0.tools\npm-cache"
set "PNPM_HOME=%~dp0.tools\pnpm-home"
call "%APPDOCK_PNPM_DIR%\pnpm.cmd" %*
set "toolResult=%errorlevel%"
if "%toolResult%"=="-1073741571" goto restrictedFailure
goto finish
:restrictedFailure
echo Local pnpm terminated with STATUS_STACK_OVERFLOW. 1>&2
echo In a restricted environment, retry this same command with execution approval. 1>&2
echo Keep the lockfile, release-age policy, and dependency verification enabled. 1>&2
goto finish
:missing
echo Project-local Node.js / pnpm are not ready. Run setup-tools.bat first.
set "toolResult=1"
:finish
popd
exit /b %toolResult%
