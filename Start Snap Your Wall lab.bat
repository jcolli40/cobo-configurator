@echo off
rem Double-click to start the Snap Your Wall lab (dev copy). Close this window to stop it.
cd /d "%~dp0"
set PORT=8002
set IP=
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do set IP=%%a
set IP=%IP: =%
title Snap Your Wall lab
echo.
echo  Snap Your Wall lab is starting.
echo.
echo    Lab (test photos, score results):  /detect/
echo    v8 (the configurator with Snap your wall):  /v8/
echo.
echo    On this computer:  http://localhost:%PORT%/v8/
echo    On your phone (same Wi-Fi):  http://%IP%:%PORT%/v8/
echo.
echo  Leave this window open while you test. Close it to stop.
echo  If Windows asks about the firewall, choose Allow (private networks).
echo.
start "" http://localhost:%PORT%/v8/
node tools/serve.js
echo.
echo  The lab stopped. If you see an error above, tell Claude what it says.
pause
