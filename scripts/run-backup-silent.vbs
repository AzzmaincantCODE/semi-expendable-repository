' Silent runner for the Supabase backup - no console window.
' Called by the "SemiPropertyGuardian Backup" scheduled task (or run by hand).
Dim shell, fso, scriptDir
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = fso.GetParentFolderName(scriptDir) ' repo root
' 0 = hidden window, True = wait for completion
shell.Run "cmd /c npm run backup >> """ & scriptDir & "\backup.log"" 2>&1", 0, True
