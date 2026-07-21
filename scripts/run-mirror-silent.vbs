' Silent runner for the Supabase live mirror - no console window.
' Called by the "SemiPropertyGuardian Mirror" scheduled task (or run by hand).
Dim shell, fso, scriptDir
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = fso.GetParentFolderName(scriptDir) ' repo root
' 0 = hidden window, True = wait for completion
shell.Run "cmd /c npm run mirror >> """ & scriptDir & "\mirror.log"" 2>&1", 0, True
