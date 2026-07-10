Dim shell, fso, currentDir
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

currentDir = fso.GetParentFolderName(WScript.ScriptFullName)

shell.Run """" & currentDir & "\build_desktop\Semi-Property Guardian-win32-x64\Semi-Property Guardian.exe""", 1, False
