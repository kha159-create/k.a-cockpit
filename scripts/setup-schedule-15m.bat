@echo off
echo ========================================
echo Setup Task Scheduler for Auto-Update
echo ========================================
echo.
echo This will create a Windows Task that runs every 15 minutes
echo to update JSON files from PostgreSQL and push to GitHub.
echo.
echo NOTE: You must run this as Administrator!
echo.
pause

powershell.exe -ExecutionPolicy Bypass -File "%~dp0setup-schedule-15m.ps1"

pause
