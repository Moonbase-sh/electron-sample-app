import { app, BrowserWindow } from 'electron';
import started from 'electron-squirrel-startup';
import moonbase from './licensing';
import path from 'node:path';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const start = () => {
  // Validate the stored license and start watching it. Whenever the app has no
  // license, at startup or after losing it, the activation UI locks the main window.
  moonbase.start();
  createWindow();
};

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools({ mode: 'detach' });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', start);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();

    // The activation UI closed with the last window, so lock the new one too
    if (!moonbase.isLicensed()) {
      void moonbase.present();
    }
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
//
// Gate paid features here, where a renderer cannot skip the check:
//
//   if (!moonbase.isLicensed()) {
//     void moonbase.present();
//     return;
//   }
