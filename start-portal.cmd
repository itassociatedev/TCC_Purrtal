@echo off
REM Run from this script's project folder, even when it is launched from another location.
cd /d "%~dp0"
REM Use PHP 8.4 for this process because the locked spreadsheet package does not support PHP 8.5.
set "PATH=C:\php84;%PATH%"
REM Serve only on this computer. Start the local MySQL server separately before signing in.
php artisan serve --host=127.0.0.1 --port=8000
REM Keep startup errors visible after the server exits.
pause
