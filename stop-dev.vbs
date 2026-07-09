Dim shell
Set shell = CreateObject("WScript.Shell")

' Kill the Vite/Node dev server (npm run dev spawns node.exe)
shell.Run "cmd /c taskkill /F /IM node.exe", 0, True

' Kill ngrok if running
shell.Run "cmd /c taskkill /F /IM ngrok.exe", 0, True
