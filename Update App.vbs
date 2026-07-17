' One-click updater for the Semi-Property Guardian desktop app.
' Rebuilds the frontend and copies it into the .exe's external app-dist folder,
' so relaunching the app shows your latest code changes WITHOUT repackaging.
Dim shell, fso, currentDir, rc
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

currentDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Run the build + sync (hidden window, wait for it to finish).
rc = shell.Run("cmd /c cd /d """ & currentDir & """ && npm run desktop:update", 0, True)

If rc = 0 Then
    MsgBox "Update complete." & vbCrLf & vbCrLf & _
           "Relaunch ""Semi-Property Guardian"" to see your changes.", _
           vbInformation, "Semi-Property Guardian"
Else
    MsgBox "Update FAILED (exit code " & rc & ")." & vbCrLf & vbCrLf & _
           "Make sure the .exe has been built once with:" & vbCrLf & _
           "    npm run electron:build", _
           vbCritical, "Semi-Property Guardian"
End If
