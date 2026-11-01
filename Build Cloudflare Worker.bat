@echo off
rem Double-click to build the Cloudflare Worker file and copy it to your clipboard, ready to paste.
cd /d "%~dp0"
title Build Cloudflare Worker
echo.
node tools/build-worker.js
if errorlevel 1 (
  echo.
  echo  Something went wrong building the file. Tell Claude what it says above.
  pause
  exit /b 1
)
clip < worker\worker.js
echo.
echo  Done. The Worker code is now copied to your clipboard.
echo  Go to your Cloudflare Worker, open "Edit code", select everything, and paste (Ctrl+V).
echo  (The file is also saved at worker\worker.js)
echo.
pause
