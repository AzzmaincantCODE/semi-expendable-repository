@echo off
REM One-time setup: registers a Windows Scheduled Task that runs the Supabase
REM live mirror silently every 20 minutes, all day, every day.
REM Run this file once (double-click). Re-running it just updates the task.

set SCRIPT_DIR=%~dp0

schtasks /Create /F /TN "SemiPropertyGuardian Mirror" ^
  /TR "wscript.exe \"%SCRIPT_DIR%run-mirror-silent.vbs\"" ^
  /SC MINUTE /MO 20

if %ERRORLEVEL% EQU 0 (
  echo.
  echo Scheduled task created - the live mirror refreshes every 20 minutes.
  echo It rebuilds a full snapshot each run, so cloud deletes disappear from
  echo the mirror automatically. Output:
  echo   %%USERPROFILE%%\Documents\SemiPropertyMirror\current  ^(JSON + Excel^)
  echo   plus a daily archive, and a copy to any external drive when connected.
  echo Run one now manually with:  npm run mirror
) else (
  echo.
  echo FAILED to create the task. Try running this file as Administrator.
)
pause
