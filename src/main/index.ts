import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { FirebaseManager } from './firebase-manager'
import { SecureStore } from './secure-store'
import { AIAgent } from './ai-agent'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    title: 'Firezen',
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app name and user model id
  app.setName('Firezen')
  electronApp.setAppUserModelId('com.firezen.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC endpoints for Firebase
  ipcMain.handle('firebase:connect', async (_, payload: { projectId?: string, json?: string } = {}) => {
    return await FirebaseManager.connect(payload.projectId, payload.json)
  })

  ipcMain.handle('firebase:getSavedProjects', async () => {
    return SecureStore.getSavedProjects()
  })

  ipcMain.handle('firebase:listCollections', async () => {
    return await FirebaseManager.listCollections()
  })

  ipcMain.handle('firebase:disconnect', async () => {
    await FirebaseManager.disconnect()
  })

  ipcMain.handle('firebase:sampleCollectionSchema', async (_, collectionName: string) => {
    return await FirebaseManager.sampleCollectionSchema(collectionName)
  })

  ipcMain.handle('firebase:executeQuery', async (_, collectionName: string, filters: any[], limit?: number) => {
    return await FirebaseManager.executeQuery(collectionName, filters, limit)
  })

  // IPC endpoints for AI setup
  ipcMain.handle('ai:setApiKey', async (_, key: string) => {
    SecureStore.saveApiKey(key)
    return { success: true }
  })

  ipcMain.handle('ai:hasApiKey', async () => {
    return SecureStore.hasApiKey()
  })

  ipcMain.handle('ai:parseQuery', async (_, prompt: string, schema: any[]) => {
    try {
      const filters = await AIAgent.parseQuery(prompt, schema)
      return { success: true, filters }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // IPC endpoints for Bulk Operations
  ipcMain.handle('firebase:bulkDelete', async (_, collectionName: string, docIds: string[]) => {
    try {
      return await FirebaseManager.bulkDelete(collectionName, docIds)
    } catch (err: any) {
      return { error: err.message }
    }
  })

  ipcMain.handle('firebase:bulkUpdateField', async (_, collectionName: string, docIds: string[], fieldName: string, newValue: any) => {
    try {
      return await FirebaseManager.bulkUpdateField(collectionName, docIds, fieldName, newValue)
    } catch (err: any) {
      return { error: err.message }
    }
  })

  ipcMain.handle('firebase:executeFqlQuery', async (_, collectionName: string, fqlString: string) => {
    try {
      const docs = await FirebaseManager.executeFqlQuery(collectionName, fqlString)
      return { success: true, docs }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('firebase:createDocument', async (_, collectionName: string, data: any, docId?: string) => {
    try {
      const result = await FirebaseManager.createDocument(collectionName, data, docId)
      return { success: true, id: result.id }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('firebase:updateDocument', async (_, collectionName: string, docId: string, data: any, fieldsToDelete: string[] = []) => {
    try {
      await FirebaseManager.updateDocument(collectionName, docId, data, fieldsToDelete)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('firebase:exportAllCollections', async () => {
    try {
      const data = await FirebaseManager.exportAllCollections()
      return { success: true, data }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('firebase:importCollection', async (_, collectionName: string, docs: any[]) => {
    try {
      const result = await FirebaseManager.importCollection(collectionName, docs)
      return { success: true, ...result }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
