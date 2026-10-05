# Moonbase.sh Electron Sample App

This app is a simple example of how to integrate Moonbase.sh for licensing into Electron apps.
It's based on the vite-typescript Electron Forge template, and runs all the licensing code in the node process to get privileged access to system information for fingerprinting.

## Getting started

Clone the repo and run the start script:

```bash
npm run start
```

## Relevant changes

To integrate the licensing bits, we've done a couple of things to the app:

### Add the Moonbase SDK

The Moonbase node.js SDK comes with the baseline features you need to:

1. Fingerprint devices
2. Validate licenses
3. Call the Moonbase APIs
4. Persist licenses to disk

Much of this is configurable, and you can also inject your own functionality for overriding certain behaviour.
We ran `npm install --save @moonbase.sh/licensing`, and then created the [licensing.ts](./src/licensing.ts) file to store the configuration in:

```ts
import { app } from "electron"
import { FileLicenseStore, MoonbaseLicensing } from "@moonbase.sh/licensing"

const licensing = new MoonbaseLicensing({
    productId: 'demo-app',
    endpoint: 'https://demo.moonbase.sh',
    publicKey: `-----BEGIN RSA PUBLIC KEY-----
...
-----END RSA PUBLIC KEY-----`,

    // Reported with every activation and validation, so you can see which
    // versions of your app your customers are running
    appVersion: app.getVersion(),

    // Keep the license with the rest of the app's data. The default is the
    // working directory, which a packaged app usually cannot write to.
    licenseStore: new FileLicenseStore({ dir: app.getPath('userData') }),
})

export default licensing
```

This instance can be used to manage the full license life-cycle.
The SDK also reports the platform automatically, and you can attach your own `metadata` to every activation and validation.

### Check license validity on startup

When the Electron app starts, [main.ts](./src/main.ts) checks for a valid license, and opens the license activation window instead of the main window if there is none:

```ts
const start = async () => {
  const license = await loadValidLicense();
  if (license) {
    createWindow();
  } else {
    createLicenseActivationWindow();
  }
};

app.on('ready', start);
```

`loadValidLicense` follows the SDK's recommended startup check:

1. An online-activated license is validated with Moonbase first. That is how a revocation reaches the app, and how a token that has expired is refreshed after a renewal. The refreshed license is stored for the next start.
2. Only when Moonbase says the license can no longer be used on this device (`LicenseRevoked`, `LicenseActivationRevoked`, `LicenseExpired`, `LicenseInvalid` or `LicenseDeviceMismatch`) is the stored license deleted.
3. Any other failure, such as an `ErrorType.ApiError` or no network at all, only means Moonbase could not be reached. The license is then validated locally (signature, device binding and expiry), so the app keeps working offline. Offline-activated licenses only ever get this local check.

Deleting the stored license on any error would make your customers re-activate every time they open the app without a connection.
To limit how long the app runs without reaching Moonbase, compare `license.validatedAt` with a limit of your choosing.

### Build a license activation window

In this sample app, we've opted to have a completely separate page and window for this, but you can choose to instead incorporate it into your main window. Like most Electron apps, this license activation window has:

* Markup: [license-activation.html](./license-activation.html)
* Preload: [licensing-preload.ts](./src/license-activation/licensing-preload.ts)
* Renderer: [renderer.ts](./src/license-activation/renderer.ts)

The page is an extra entry in [vite.renderer.config.ts](./vite.renderer.config.ts), so it is included when the app is packaged.

The renderer is a very simple binding to the API provided by the preload script, and the preload script simply forwards any calls to the main IPC handlers that can execute licensing code in the node process.
Those handlers are registered once in [main.ts](./src/main.ts), and act on whichever window called them:

```ts
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
```

Moonbase offers multiple licensing flows, but the one above is the one we recommend; simply open a browser for your website where users can activate seamlessly through the customer portal. Our experience tells us this process is usually a one-click process if they have a license already, and otherwise they are free to start a time-limited trial if your Moonbase product is set up to allow that.

For customers without internet access, the window also supports offline activation: the app saves a device token that the customer uploads to the customer portal, and then selects the license file they get back.

Errors thrown by the SDK carry Moonbase's own message (for example that a license was revoked), which the activation window shows to the customer.

### Upgrading from an older SDK

Version 3 of `@moonbase.sh/licensing` computes device ids with the cross-SDK Moonbase device fingerprint, so a license activated with an older version reports `LicenseDeviceMismatch` and the customer activates again.
If you already have customers, see "Migrating from v2.x" in the [SDK readme](https://www.npmjs.com/package/@moonbase.sh/licensing) for `MigratingDeviceIdResolver`, which keeps accepting the old device id while new activations bind the new one.

## Questions about this sample?

Please reach out to us through the support channel in the app or at developers@moonbase.sh!
