const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// Resolve which built frontend the packaged app should load.
// Priority: an external, updatable `app-dist` folder sitting next to the .exe
// (written by `npm run desktop:update`) so code changes show up WITHOUT
// repackaging the exe. Falls back to the dist copy embedded in the exe.
function resolveIndexHtml() {
  const exeDir = path.dirname(app.getPath('exe'));
  const externalIndex = path.join(exeDir, 'app-dist', 'index.html');
  const embeddedIndex = path.join(__dirname, '..', 'dist', 'index.html');
  return fs.existsSync(externalIndex) ? externalIndex : embeddedIndex;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'Semi-Property Guardian',
    icon: path.join(__dirname, '..', 'public', 'gso-logo.ico'),
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(resolveIndexHtml());
  }

  // Set application menu (can be basic or none)
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ]));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
