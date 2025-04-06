import { contextBridge, ipcRenderer } from "electron"

// We need to expose some licensing API to the frontend
contextBridge.exposeInMainWorld('licensing', {
    // We want to let the main process handle the core activation flow
    startActivation: () => ipcRenderer.invoke('licensing:activate')
})
