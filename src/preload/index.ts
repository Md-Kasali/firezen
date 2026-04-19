import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  connect: (payload: { projectId?: string, json?: string } = {}) => ipcRenderer.invoke('firebase:connect', payload),
  getSavedProjects: () => ipcRenderer.invoke('firebase:getSavedProjects'),
  listCollections: () => ipcRenderer.invoke('firebase:listCollections'),
  disconnect: () => ipcRenderer.invoke('firebase:disconnect'),
  sampleCollectionSchema: (collectionName: string) => ipcRenderer.invoke('firebase:sampleCollectionSchema', collectionName),
  executeQuery: (collectionName: string, filters: any[], limit?: number) => ipcRenderer.invoke('firebase:executeQuery', collectionName, filters, limit),
  ai: {
    setApiKey: (key: string) => ipcRenderer.invoke('ai:setApiKey', key),
    hasApiKey: () => ipcRenderer.invoke('ai:hasApiKey'),
    parseQuery: (prompt: string, schema: any[]) => ipcRenderer.invoke('ai:parseQuery', prompt, schema)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
