import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      connect: (payload?: { projectId?: string, json?: string }) => Promise<{ success: boolean; error?: string; projectId?: string }>
      getSavedProjects: () => Promise<string[]>
      listCollections: () => Promise<Array<{ id: string; path: string }>>
      disconnect: () => Promise<void>
      sampleCollectionSchema: (collectionName: string) => Promise<Array<{ name: string; type: string }>>
      executeQuery: (collectionName: string, filters: any[], limit?: number) => Promise<Array<any>>
      ai: {
        setApiKey: (key: string) => Promise<{ success: boolean; error?: string }>
        hasApiKey: () => Promise<boolean>
        parseQuery: (prompt: string, schema: any[]) => Promise<{ success: boolean; filters?: any[]; error?: string }>
      }
    }
  }
}
