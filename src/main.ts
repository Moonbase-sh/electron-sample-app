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

const withLicensing = async (next: () => void) => {
  // This guard will check for a local license, and either start the actual
  // main window if still valid, or open the license activation flow instead.
  const localLicense = await licensing.store.loadLocalLicense();
  if (!localLicense) {
    // We didn't find an existing license; show the activation UI
    createLicenseActivationWindow()
  } else {
    try {
      if (localLicense.activationMethod === ActivationMethod.Offline) {
        // If the license is an offline-activated license, we only validate it locally:
        await licensing.validator.validateLicense(localLicense.token)
      } else {
        // There is a local (online) license; let's quickly validate it
        const validatedLicense = await licensing.client.validateLicense(localLicense);

        // Now that we have an updated license, persist it
        await licensing.store.storeLocalLicense(validatedLicense);
      }

      // License has been validated, the app can now start
      next()
    } catch (err) {
      if (err instanceof MoonbaseError && (err.type === ErrorType.LicenseExpired || err.type === ErrorType.LicenseInvalid || err.type === ErrorType.LicenseRevoked)) {
        // The license is no longer valid, remove the local one and show the gate
        await licensing.store.deleteLocalLicense()
        createLicenseActivationWindow()
      }
      throw err
    }
  }
}

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
    if (details.url.startsWith('https://demo.moonbase.sh')) {
      shell.openExternal(details.url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    licenseActivationWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/license-activation.html`);
  } else {
    licenseActivationWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/license-activation.html`));
  }

  // Open the DevTools.
  licenseActivationWindow.webContents.openDevTools({ mode: 'detach' });

  ipcMain.handle('licensing:activate', async () => {
    // Once license activation starts, we want to request an activation:
    const activationRequest = await licensing.client.requestActivation()

    // Since this is completed in the native browser of the device, start the URL normally:
    shell.openExternal(activationRequest.browser)

    // Then we can start polling for completion:
    let license: License | null = null

    do {
      await new Promise((resolve) => setTimeout(() => resolve(void 0), 1000))
      license = await licensing.client.getRequestedActivation(activationRequest)
    } while (license == null)

    // We finally got a license to activate with; persist it so we can load it on next start
    await licensing.store.storeLocalLicense(license)

    // Then we can hide the license activation window and show the main window
    licenseActivationWindow.close()
    createWindow()
  })

  ipcMain.handle('licensing:generate-device-token', async () => {
    // Activating offline means we need to generate a device token and hand over to the user:
    const bytes = await licensing.generateDeviceToken()
    const tokenPath = path.join(path.resolve(), 'device.dt')
    await fs.writeFile(tokenPath, bytes)
  })

  ipcMain.handle('licensing:select-license-token', async () => {
    // Selecting license token will allow the customer to pick the generated offline license:
    const result = await dialog.showOpenDialog(licenseActivationWindow, {
      properties: ['openFile']
    })
    if (result.canceled) return

    const bytes = await fs.readFile(result.filePaths[0])
    const license = await licensing.readRawLicense(bytes)

    // The license is valid, so we can store it for the next open
    await licensing.store.storeLocalLicense(license)

    // Then we can hide the license activation window and show the main window
    licenseActivationWindow.close()
    createWindow()
  })
}

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
app.on('ready', () => withLicensing(createWindow));

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
    withLicensing(createWindow);
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// We also expose a simple IPC method to get the current license
ipcMain.handle('licensing:get', async () => {
  return await licensing.store.loadLocalLicense()
})
