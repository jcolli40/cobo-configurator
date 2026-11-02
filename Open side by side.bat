@echo off
rem Starts the local preview server and opens the computer + phone side-by-side page in your normal browser.
cd /d "%~dp0"
start "COBO preview server" /min node tools\serve.js
timeout /t 2 /nobreak >nul
start "" "http://localhost:8000/screenshots/side-by-side.html"
