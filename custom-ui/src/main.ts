import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import started from 'electron-squirrel-startup';
import licensing from './licensing';
import fs from 'node:fs/promises';
import path from 'node:path';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Whether the app had a license at the last change, so the windows only switch when that does
let licensed: boolean | null = null;

licensing.subscribe((state) => {
  // Hand every change to the windows, so they can show it
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('licensing:state-changed', state);
  }

  // Open the first window once the stored license has been checked, and switch
  // windows whenever the app gains or loses its license after that: once it is
  // activated, and when it is deactivated, revoked or runs out
  if (state.status === 'loading' || state.licensed === licensed) return;
  licensed = state.licensed;
  showWindow();
});

const start = () => {
  // Validate the stored license, and keep watching it while the app runs
  licensing.start();
};

const showWindow = () => {
  // Open the main window while the app is licensed, and the license activation
  // window while it is not, in place of whichever was open
  const previousWindows = BrowserWindow.getAllWindows();
  if (licensing.isLicensed()) {
    createWindow();
  } else {
    createLicenseActivationWindow();
  }
  for (const window of previousWindows) {
    window.close();
  }
};

const createLicenseActivationWindow = () => {
  // Create the browser window.
  const licenseActivationWindow = new BrowserWindow({
    width: 440,
    height: 640,
    useContentSize: true,
    webPreferences: {
      preload: path.join(__dirname, 'licensing-preload.js'),
    },
    resizable: false,
  });

  // We have links that should open in an external browser: the activation in
  // progress, which may be on the store's own site, and Moonbase's pages
  licenseActivationWindow.webContents.setWindowOpenHandler(details => {
    if (details.url === licensing.state().activation?.browserUrl || details.url.startsWith('https://demo.moonbase.sh/')) {
      shell.openExternal(details.url);
    }
    return { action: 'deny' };
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    licenseActivationWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/license-activation.html`);
  } else {
    licenseActivationWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/license-activation.html`));
  }

  // Open the DevTools.
  licenseActivationWindow.webContents.openDevTools({ mode: 'detach' });
};

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 760,
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
  // dock icon is clicked and there are no other windows open. While the
  // stored license is being checked, the subscriber opens it once it has been.
  if (BrowserWindow.getAllWindows().length === 0 && licensing.state().status !== 'loading') {
    showWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// The windows read the license state through this, and get every change pushed to them
ipcMain.handle('licensing:state', () => licensing.state());

// The license activation window drives these handlers. They are registered once,
// as a channel can only have one handler, and act on whichever window called them.
ipcMain.handle('licensing:activate', async () => {
  // This opens the customer's browser to activate in, and waits for the license
  // in the background. Once it lands, the controller stores it and the
  // subscriber switches to the main window.
  await licensing.activate();
});

ipcMain.handle('licensing:cancel-activation', () => {
  licensing.cancelActivation();
});

ipcMain.handle('licensing:upgrade', async () => {
  // Opens the page to buy the upgrade at, for a license that doesn't cover this version
  await licensing.upgradeLicense();
});

ipcMain.handle('licensing:refresh', async () => {
  // Checks the license with Moonbase again, so an upgrade just bought unlocks the app
  await licensing.refresh();
});

ipcMain.handle('licensing:generate-device-token', async (event) => {
  // Activating offline means we need to generate a device token and hand over to the user:
  const token = await licensing.deviceToken();

  const result = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
    defaultPath: path.join(app.getPath('downloads'), 'device.dt'),
    filters: [{ name: 'Device token', extensions: ['dt'] }],
  });
  if (result.canceled) return false;

  await fs.writeFile(result.filePath, token);
  return true;
});

ipcMain.handle('licensing:select-license-token', async (event) => {
  // Selecting license token will allow the customer to pick the generated offline license:
  const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    properties: ['openFile'],
    filters: [{ name: 'License file', extensions: ['mb'] }],
  });
  if (result.canceled) return;

  // The controller validates the license and stores it, and the subscriber
  // then switches to the main window
  await licensing.activateOffline(await fs.readFile(result.filePaths[0], 'utf8'));
});

// The main window drives this one. Once deactivated, the app has no license, and
// the subscriber switches to the license activation window.
ipcMain.handle('licensing:deactivate', async () => {
  await licensing.deactivate();
});
