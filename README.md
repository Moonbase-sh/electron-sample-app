# Moonbase.sh Electron Sample Apps

These apps show two ways to integrate Moonbase.sh for licensing into an Electron app.
Both are based on the vite-typescript Electron Forge template, run all the licensing code in the main process to get privileged access to system information for fingerprinting, and are wired to Moonbase's public demo store (`demo.moonbase.sh`, product `demo-app`), so they activate out of the box.

| Example | Package | Pick it when |
| --- | --- | --- |
| [Built-in UI](#built-in-ui-moonbaseshelectron) | [`@moonbase.sh/electron`](https://www.npmjs.com/package/@moonbase.sh/electron) | You want a finished activation UI: online and offline activation, trials, license details, deactivation and updates, with no renderer code |
| [Custom UI](#custom-ui-moonbaseshlicensing) | [`@moonbase.sh/licensing`](https://www.npmjs.com/package/@moonbase.sh/licensing) | You want to design the activation UI yourself, and drive the SDK's activation controller from it |

Each example is a standalone app, so you can copy either folder to start your own.

## Getting started

Clone the repo, pick an example, and run the start script:

```bash
cd built-in-ui # or custom-ui
npm install
npm run start
```

## Built-in UI: `@moonbase.sh/electron`

![The built-in activation UI locking the main window](./docs/built-in-ui.png)

[`@moonbase.sh/electron`](https://www.npmjs.com/package/@moonbase.sh/electron) builds on the licensing SDK, and brings the same activation UI as Moonbase's JUCE module and Tauri plugin.
It validates the stored license at startup, presents the UI whenever the app has no license, and keeps watching the license while the app runs.
In this example the UI is laid over the main window, which stays blurred and locked until the app is licensed.

### Add the module

We ran `npm install --save @moonbase.sh/electron`, and then created the [licensing.ts](./built-in-ui/src/licensing.ts) file to store the configuration in:

```ts
import { createMoonbase } from "@moonbase.sh/electron"

// The license is kept in license.mb in the app's user data folder, and
// app.getVersion() is reported to Moonbase, so neither needs setting here
const moonbase = createMoonbase({
    productId: 'demo-app',
    endpoint: 'https://demo.moonbase.sh',
    publicKey: `-----BEGIN RSA PUBLIC KEY-----
...
-----END RSA PUBLIC KEY-----`,

    // The built-in activation UI, which presents itself whenever the app has no license
    ui: {
        productName: 'Electron Sample App',

        // Lay the activation UI over the main window, which stays locked until the
        // app is licensed. Leave this out to show it in a window of its own instead,
        // for an app that stays usable without a license.
        presentation: 'overlay',
    },

    // The main window only shows the license and opens the activation UI, so that
    // is all its renderer may do through window.moonbase
    rendererAccess: 'read-only',
})

export default moonbase
```

The UI can carry your brand: an accent colour, your logo, the features of your trial, and your own copy for every screen.
See [the activation UI options](https://www.npmjs.com/package/@moonbase.sh/electron#the-activation-ui) for all of them.

### Start it

[main.ts](./built-in-ui/src/main.ts) starts the module and opens the main window right away. There is no license check to write: while the app has no license, the module locks that window.

```ts
const start = () => {
  moonbase.start();
  createWindow();
};

app.on('ready', start);
```

When the locked window closes, the overlay moves to the next window the app opens, such as the one a macOS app opens again from the dock.
The overlay locks the interface, so gate your paid features in the main process too, where a renderer cannot skip the check:

```ts
if (!moonbase.isLicensed()) {
  void moonbase.present();
  return;
}
```

### Show the license in the app

The [preload script](./built-in-ui/src/preload.ts) exposes the module's renderer API as `window.moonbase`:

```ts
import { exposeMoonbase } from "@moonbase.sh/electron/preload";

exposeMoonbase()
```

The [renderer](./built-in-ui/src/renderer.ts) then shows the license, and updates it whenever it changes. Importing its types from `@moonbase.sh/electron/renderer` also types `window.moonbase`. The **Manage license** button opens the built-in license details, where the customer can copy their license ID for support or deactivate this device:

```ts
import type { ActivationState } from '@moonbase.sh/electron/renderer';

const moonbase = window.moonbase
moonbase.onStateChanged(render)
render(await moonbase.state())

document.getElementById('manage-license').addEventListener('click', () => moonbase.present({ screen: 'license' }))
```

To build your own UI on top of the module instead, pass `ui: false` and drive activation through `window.moonbase` with the default `rendererAccess`.

### Bundle the activation UI

The module loads its activation UI from the folder it runs from, and Electron Forge's Vite plugin bundles every dependency into the main process.
So [vite.main.config.ts](./built-in-ui/vite.main.config.ts) adds the module's Vite plugin, which copies the UI beside the bundle:

```ts
import { defineConfig } from 'vite';
import { moonbase } from '@moonbase.sh/electron/vite';

export default defineConfig({
  plugins: [moonbase()],
});
```

With another bundler, see [bundling the main process](https://www.npmjs.com/package/@moonbase.sh/electron#bundling-the-main-process).
If the UI is missing, `moonbase.start()` throws and names the folder it looked in.

## Custom UI: `@moonbase.sh/licensing`

![The custom license activation window](./docs/custom-ui.png)

This example drives the licensing SDK's `ActivationController` from the main process, and has a separate window of its own for license activation.

### Add the Moonbase SDK

The Moonbase node.js SDK comes with the baseline features you need to:

1. Fingerprint devices
2. Validate licenses
3. Call the Moonbase APIs
4. Persist licenses to disk

Its `ActivationController` puts these together into the activation state machine that `@moonbase.sh/electron` is built on, for a UI of your own.
We ran `npm install --save @moonbase.sh/licensing`, and then created the [licensing.ts](./custom-ui/src/licensing.ts) file to configure the controller in:

```ts
import { app, shell } from "electron"
import { ActivationController } from "@moonbase.sh/licensing"
import path from "node:path"

// The activation state machine: it validates the stored license, runs browser and
// offline activation, and keeps watching the license while the app runs
const licensing = new ActivationController({
    productId: 'demo-app',
    endpoint: 'https://demo.moonbase.sh',
    publicKey: `-----BEGIN RSA PUBLIC KEY-----
...
-----END RSA PUBLIC KEY-----`,

    // Reported with every activation and validation, so you can see which
    // versions of your app your customers are running
    appVersion: app.getVersion(),

    // Keep the license with the rest of the app's data, as a packaged app
    // usually cannot write to its working directory
    licenseFile: path.join(app.getPath('userData'), 'license.mb'),

    // Customers activate in their own browser
    openUrl: (url) => shell.openExternal(url),
})

export default licensing
```

Besides `licenseFile` and `openUrl`, the controller takes the same options as `MoonbaseLicensing`, such as your own `metadata` to attach to every activation and validation.
The SDK also reports the platform automatically, and `licensing.licensing` is the SDK underneath, for anything the controller does not wrap.

### Check license validity on startup

When the Electron app starts, [main.ts](./custom-ui/src/main.ts) starts the controller, and opens the main window once the app has a valid license, or the license activation window if it has none.
A subscriber does this, so it switches windows whenever the app gains or loses its license while it runs too:

```ts
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

app.on('ready', start);
```

The controller follows the SDK's recommended startup check, so there is none to write:

1. An online-activated license is validated with Moonbase, unless it was in the last 5 minutes (`checkInterval`). That is how a revocation reaches the app, and how a token that has expired is refreshed after a renewal. The refreshed license is stored for the next start.
2. A license Moonbase no longer accepts (revoked, expired, or bound to another device) locks the app, and `state.lockReason` says why.
3. When Moonbase cannot be reached, the license is validated locally (signature, device binding and expiry), and keeps working for 7 days after it was last validated online (`gracePeriod`), so customers can open the app without a connection. Offline-activated licenses only ever get this local check.

While the app runs, the controller also locks a license whose expiry or grace period passes, and picks up a license that another instance of the app activates or removes.
`state.status` also tells trials (`trial` and `trialExpired`) and a license that doesn't cover this version of the app (`notCovered`) apart, for a UI that wants to show them; see "A UI of your own" in the [SDK readme](https://www.npmjs.com/package/@moonbase.sh/licensing) for the full state.

### Build a license activation window

In this example, we've opted to have a completely separate page and window for this, but you can choose to instead incorporate it into your main window. Like most Electron apps, this license activation window has:

* Markup: [license-activation.html](./custom-ui/license-activation.html)
* Preload: [licensing-preload.ts](./custom-ui/src/license-activation/licensing-preload.ts)
* Renderer: [renderer.ts](./custom-ui/src/license-activation/renderer.ts)

The page is an extra entry in [vite.renderer.config.ts](./custom-ui/vite.renderer.config.ts), so it is included when the app is packaged.

The renderer is a very simple binding to the API provided by the preload script, and the preload script simply forwards any calls to the main IPC handlers that can execute licensing code in the node process.
Those handlers are registered once in [main.ts](./custom-ui/src/main.ts). Activating is a single call, as the controller polls Moonbase for the license and stores it:

```ts
ipcMain.handle('licensing:activate', async () => {
  // This opens the customer's browser to activate in, and waits for the license
  // in the background. Once it lands, the controller stores it and the
  // subscriber switches to the main window.
  await licensing.activate();
});
```

Moonbase offers multiple licensing flows, but the one above is the one we recommend; simply open a browser for your website where users can activate seamlessly through the customer portal. Our experience tells us this process is usually a one-click process if they have a license already, and otherwise they are free to start a time-limited trial if your Moonbase product is set up to allow that.

For customers without internet access, the window also supports offline activation: the app saves the device token from `licensing.deviceToken()`, which the customer uploads to the customer portal, and passes the license file they get back to `licensing.activateOffline()`.

The window renders the license state the subscriber pushes to it, with a screen for each `state.status`:

* `unlicensed` and `trialExpired`: activate in the browser, with a note on why the app is locked when it had a license before (`state.lockReason`, or the trial in `state.expiredTrial`)
* `activating`: waiting for the browser, with a link back to the activation page (`state.activation.browserUrl`) and a button to cancel
* `notCovered`: what the license covers (`state.notCovered`), with buttons to buy the upgrade (`licensing.upgradeLicense()`) and check the license again after (`licensing.refresh()`)

When something fails, `state.error.message` says why in words meant for the customer (for example that a license file isn't valid for this device).

### Show the license in the app

The main window gets the same state through its own [preload script](./custom-ui/src/preload.ts), and its [renderer](./custom-ui/src/renderer.ts) shows what the license says: who it is licensed to, its type and expiry, which versions it covers, its seats and add-ons, and when it was last checked with Moonbase.
It also has a button to deactivate this computer with `licensing.deactivate()`, which frees its seat (a trial or an offline license is only removed from this computer), after which the subscriber switches back to the license activation window.

## Upgrading from an older SDK

Version 3 of `@moonbase.sh/licensing`, which both examples use, computes device ids with the cross-SDK Moonbase device fingerprint, so a license activated with an older version reports `LicenseDeviceMismatch` and the customer activates again.
If you already have customers, see "Migrating from v2.x" in the [SDK readme](https://www.npmjs.com/package/@moonbase.sh/licensing) for `MigratingDeviceIdResolver`, which keeps accepting the old device id while new activations bind the new one.
`createMoonbase` and `ActivationController` take the same `deviceIdResolver` option as `MoonbaseLicensing`.

## Questions about these samples?

Please reach out to us through the support channel in the app or at developers@moonbase.sh!
