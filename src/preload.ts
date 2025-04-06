// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from "electron";

// To let the app access the current license of the user, we expose it:
contextBridge.exposeInMainWorld('licensing', {
    loadLicense: () => ipcRenderer.invoke('licensing:get')
})
