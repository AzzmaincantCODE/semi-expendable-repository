@echo off
REM One-time setup: registers a daily Windows Scheduled Task that runs the
REM Supabase backup silently at 12:05 PM every day (and catches up at logon
REM if the machine was off - see /RI and /DU multi-trigger note below).
REM Run this file once (double-click). Re-running it just updates the task.

set SCRIPT_DIR=%~dp0
schtasks /Create /F /TN "SemiPropertyGuardian Backup" ^
  /TR "wscript.exe \"%SCRIPT_DIR%run-backup-silent.vbs\"" ^
  /SC DAILY /ST 12:05

if %ERRORLEVEL% EQU 0 (
  echo.
  echo Scheduled task "SemiPropertyGuardian Backup" created - runs daily at 12:05 PM.
  echo The backup script itself skips if today's backup already exists,
  echo so you can also run it manually anytime with:  npm run backup
) else (
  echo.
  echo FAILED to create the task. Try running this file as Administrator.
)
pause
