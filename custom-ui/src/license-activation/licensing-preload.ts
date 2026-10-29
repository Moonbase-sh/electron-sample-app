import type { ActivationState } from "@moonbase.sh/licensing"
import { contextBridge, ipcRenderer } from "electron"

// We need to expose some licensing API to the frontend
contextBridge.exposeInMainWorld('licensing', {
    // The license state, and every change to it, so the window can show how
    // activation is going, and why it failed
    state: () => ipcRenderer.invoke('licensing:state'),
    onStateChanged: (listener: (state: ActivationState) => void) => {
        ipcRenderer.on('licensing:state-changed', (_event, state) => listener(state))
    },

    // We want to let the main process handle the core activation flow, so we expose
    // a number of APIs to initiate the different flows:

    // Start activation will start the main browser based activation flow, and
    // cancel activation stops waiting for it
    startActivation: () => ipcRenderer.invoke('licensing:activate'),
    cancelActivation: () => ipcRenderer.invoke('licensing:cancel-activation'),

    // For a license that doesn't cover this version of the app, upgrade license opens
    // the page to buy the upgrade at, and refresh checks the license again after
    upgradeLicense: () => ipcRenderer.invoke('licensing:upgrade'),
    refresh: () => ipcRenderer.invoke('licensing:refresh'),

    // Generate device token will ask where to save a `device.dt` file which can be
    // uploaded to the customer portal for **offline activations**.
    generateDeviceToken: () => ipcRenderer.invoke('licensing:generate-device-token'),

    // Select license token will open a file picker for the downloaded license token
    // received from the customer portal for **offline activations**.
    selectLicenseToken: () => ipcRenderer.invoke('licensing:select-license-token'),
})
