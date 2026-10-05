import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import started from 'electron-squirrel-startup';
import { ActivationMethod, ErrorType, License, MoonbaseError } from '@moonbase.sh/licensing';
import licensing from './licensing';
import fs from 'node:fs/promises';
import path from 'node:path';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Moonbase says the license can no longer be used on this device. Anything
// else, an ErrorType.ApiError or a network failure (which is not a
// MoonbaseError), only means Moonbase could not be reached right now.
const licenseGone = new Set<ErrorType | undefined>([
  ErrorType.LicenseRevoked,
  ErrorType.LicenseActivationRevoked,
  ErrorType.LicenseExpired,
  ErrorType.LicenseInvalid,
  ErrorType.LicenseDeviceMismatch,
]);

const loadValidLicense = async (): Promise<License | null> => {
  let localLicense: License | null;
  try {
    localLicense = await licensing.store.loadLocalLicense();
  } catch (err) {
    // The stored license could not be read; activating again will replace it
    if (err instanceof MoonbaseError) return null;
    throw err;
  }
  if (!localLicense) return null;

  if (localLicense.activationMethod === ActivationMethod.Online) {
    try {
      // Ask Moonbase first: it is how a revocation reaches the app, and how a
      // token whose expiry has passed is refreshed after a renewal
      const refreshed = await licensing.client.validateLicense(localLicense);
      await licensing.store.storeLocalLicense(refreshed);
      return refreshed;
    } catch (err) {
      if (err instanceof MoonbaseError && licenseGone.has(err.type)) {
        await licensing.store.deleteLocalLicense();
        return null;
      }
      // Moonbase could not be reached, so check the license locally instead.
      // To limit how long the app runs without reaching Moonbase, compare
      // localLicense.validatedAt with a limit of your choosing here.
    }
  }

  try {
    // Signature, device binding and expiry, which needs no network. This is
    // the only check an offline-activated license gets.
    return await licensing.validator.validateLicense(localLicense.token);
  } catch (err) {
    // Keep the stored token: only Moonbase can say the license is gone, and the
    // next launch that reaches it can still refresh a token that has expired
    if (err instanceof MoonbaseError) return null;
    throw err;
  }
};

const start = async () => {
  // This guard checks for a valid license, and either starts the actual
  // main window, or opens the license activation flow instead.
  const license = await loadValidLicense();
  if (license) {
    createWindow();
  } else {
    createLicenseActivationWindow();
  }
};

const createLicenseActivationWindow = () => {
  // Create the browser window.
  const licenseActivationWindow = new BrowserWindow({
    width: 320,
    height: 420,
    webPreferences: {
      preload: path.join(__dirname, 'licensing-preload.js'),
    },
    resizable: false,
  });

  // We have a link that should open in an external browser
  licenseActivationWindow.webContents.setWindowOpenHandler(details => {
    if (details.url.startsWith('https://demo.moonbase.sh/')) {
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
    start();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// The license activation window drives these handlers. They are registered once,
// as a channel can only have one handler, and act on whichever window called them.
ipcMain.handle('licensing:activate', async (event) => {
  // Once license activation starts, we want to request an activation:
  const activationRequest = await licensing.client.requestActivation();

  // Since this is completed in the native browser of the device, start the URL normally:
  shell.openExternal(activationRequest.browser);

  // Then we can start polling for completion:
  let license: License | null = null;

  do {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Stop polling if the user closed the window in the meantime
    if (event.sender.isDestroyed()) return;

    license = await licensing.client.getRequestedActivation(activationRequest);
  } while (license == null);

  // We finally got a license to activate with; persist it so we can load it on next start
  await licensing.store.storeLocalLicense(license);

  // Then we can hide the license activation window and show the main window
  BrowserWindow.fromWebContents(event.sender)?.close();
  createWindow();
});

ipcMain.handle('licensing:generate-device-token', async (event) => {
  // Activating offline means we need to generate a device token and hand over to the user:
  const bytes = await licensing.generateDeviceToken();

  const result = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
    defaultPath: path.join(app.getPath('downloads'), 'device.dt'),
    filters: [{ name: 'Device token', extensions: ['dt'] }],
  });
  if (result.canceled) return false;

  await fs.writeFile(result.filePath, bytes);
  return true;
});

ipcMain.handle('licensing:select-license-token', async (event) => {
  // Selecting license token will allow the customer to pick the generated offline license:
  const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    properties: ['openFile'],
    filters: [{ name: 'License file', extensions: ['mb'] }],
  });
  if (result.canceled) return;

  const bytes = await fs.readFile(result.filePaths[0]);
  const license = await licensing.readRawLicense(bytes);

  // The license is valid, so we can store it for the next open
  await licensing.store.storeLocalLicense(license);

  // Then we can hide the license activation window and show the main window
  BrowserWindow.fromWebContents(event.sender)?.close();
  createWindow();
});

// We also expose a simple IPC method to get the current license
ipcMain.handle('licensing:get', async () => {
  return await licensing.store.loadLocalLicense();
});
