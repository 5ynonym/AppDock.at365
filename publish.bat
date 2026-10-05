@echo off
setlocal
pushd "%~dp0"
where pnpm >nul 2>nul
if errorlevel 1 (
  echo pnpm is required. Install Node.js 24 and pnpm 11 first.
  popd
  exit /b 1
)
call pnpm run dist
set "buildResult=%errorlevel%"
popd
exit /b %buildResult%
