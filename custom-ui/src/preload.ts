// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import type { ActivationState } from "@moonbase.sh/licensing";
import { contextBridge, ipcRenderer } from "electron";

// To let the app show the current license of the user, we expose the license state:
contextBridge.exposeInMainWorld('licensing', {
    state: () => ipcRenderer.invoke('licensing:state'),
    onStateChanged: (listener: (state: ActivationState) => void) => {
        ipcRenderer.on('licensing:state-changed', (_event, state) => listener(state))
    },

    // Deactivate frees this computer's seat, so the customer can move the license elsewhere
    deactivate: () => ipcRenderer.invoke('licensing:deactivate'),
})
