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
  bulkDelete: (collectionName: string, docIds: string[]) => ipcRenderer.invoke('firebase:bulkDelete', collectionName, docIds),
  bulkUpdateField: (collectionName: string, docIds: string[], fieldName: string, newValue: any) => ipcRenderer.invoke('firebase:bulkUpdateField', collectionName, docIds, fieldName, newValue),
  executeFqlQuery: (collectionName: string, fqlString: string) => ipcRenderer.invoke('firebase:executeFqlQuery', collectionName, fqlString),
  createDocument: (collectionName: string, data: any, docId?: string) => ipcRenderer.invoke('firebase:createDocument', collectionName, data, docId),
  updateDocument: (collectionName: string, docId: string, data: any, fieldsToDelete?: string[]) => ipcRenderer.invoke('firebase:updateDocument', collectionName, docId, data, fieldsToDelete),
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
