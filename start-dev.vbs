Dim shell
Set shell = CreateObject("WScript.Shell")

Dim projectDir
projectDir = "C:\Users\plays\Downloads\semiproperty-guardian-main\semiproperty-guardian-main"

' 1. Start npm run dev silently (window style 0 = hidden, False = don't wait)
shell.Run "cmd /c cd /d """ & projectDir & """ && npm run dev", 0, False

' 2. Wait 6 seconds for the server to boot
WScript.Sleep 6000

' 3. Open the browser
shell.Run "http://localhost:8080", 1, False

' 4. Check if ngrok is installed (wait for result, window hidden)
Dim ngrokCheck
ngrokCheck = shell.Run("cmd /c where ngrok", 0, True)

If ngrokCheck = 0 Then
    ' ngrok found — start it silently in background
    shell.Run "cmd /c ngrok http 8080", 0, False
Else
    ' ngrok not found — open download page
    shell.Run "https://ngrok.com/download", 1, False
End If
