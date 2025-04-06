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
import { FileLicenseStore, MoonbaseLicensing } from "@moonbase.sh/licensing"

const licensing = new MoonbaseLicensing({
    productId: 'demo-app',
    endpoint: 'https://demo.moonbase.sh',
    publicKey: `-----BEGIN RSA PUBLIC KEY-----
MIIBCgKCAQEAutOqeUiPMgYjAwQ53CyKhJSqojr2bejce0CshQi9Hd8mNZbkoROx
oS56eIzehFSlX4YwHnF47AR1+fPOe7Q33Cgzd6d9xqksiMH7sWK2mADIlB66vZdW
uk3Me0UMB22Biy1RQbSRMivu79MxCofsympoL/5CFjJLd1u37kxjuRWVLjJS84Rr
3L2W7R7Exnno/giC+L/Dv711mjgstmtlAQm5ZINvFvoLA1eFTDs6nlCs3dpJSiq3
fsBUMT9FtudzS5As54jeT/8MB66fJJ0A1LQ/v5CW8ACQYseFSIoOKErD3xU7QLIJ
ERUn++6CVMPvZo67jVbTY+GCXYfW4gGVZQIDAQAB
-----END RSA PUBLIC KEY-----`,

    licenseStore: new FileLicenseStore(),
})

export default licensing
```

This instance can be used to manage the full license life-cycle.

### Check license validity on startup

When the Electron app starts, we've added some code in [main.ts](./src/main.ts) to start up an alternate license activation window:

```ts
const withLicensing = async (next: () => void) => {
  // This guard will check for a local license, and either start the actual
  // main window if still valid, or open the license activation flow instead.
  ...
}

app.on('ready', () => withLicensing(createWindow));
```

### Build a license activation window

In this sample app, we've opted to have a completely separate page and window for this, but you can choose to instead incorporate it into your main window. Like most Electron apps, this license activation window has:

* Markup: [license-activation.html](./license-activation.html)
* Preload: [licensing-preload.ts](./src/license-activation/licensing-preload.ts)
* Renderer: [renderer.ts](./src/license-activation/renderer.ts)

The renderer is a very simple binding to the API provided by the preload script, and the preload script simply forward any calls to the main IPC handler that can execute licensing code in the node process. We set up this handler when starting this window in the first place:

```ts

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

  ...

  ipcMain.handle('licensing:activate', async () => {
    // Once license activation starts, we want to request an activation:
    const activationRequest = await licensing.client.requestActivation()

    // Since this is completed in the native browser of the device, start the URL normally:
    open(activationRequest.browser)

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
}
```

Moonbase offers multiple licensing flows, but the one above is the one we recommend; simply open a browser for your website where users can activate seamlessly through the customer portal. Our experience tells us this process is usually a one-click process if they have a license already, and otherwise they are free to start a time-limited trial if your Moonbase product is set up to allow that.

## Questions about this sample?

Please reach out to us through the support channel in the app or at developers@moonbase.sh!
