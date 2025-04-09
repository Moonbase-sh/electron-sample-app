import { contextBridge, ipcRenderer } from "electron"

// We need to expose some licensing API to the frontend
contextBridge.exposeInMainWorld('licensing', {
    // We want to let the main process handle the core activation flow, so we expose
    // a number of APIs to initiate the different flows:

    // Start activation will start the main browser based activation flow
    startActivation: () => ipcRenderer.invoke('licensing:activate'),

    // Generate device token will spit out a `device.dt` file which can be uploaded
    // to the customer portal for **offline activations**.
    generateDeviceToken: () => ipcRenderer.invoke('licensing:generate-device-token'),

    // Select license token will open a file picker for the downloaded license token
    // received from the customer portal for **offline activations**.
    selectLicenseToken: () => ipcRenderer.invoke('licensing:select-license-token'),
})
