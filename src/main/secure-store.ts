import StoreModule from 'electron-store'
import { safeStorage } from 'electron'

const Store = (StoreModule as any).default || StoreModule
const store = new Store()

export class SecureStore {
  static saveCredentials(serviceAccountJson: string): boolean {
    let projectId = 'unknown'
    try {
      const parsed = JSON.parse(serviceAccountJson)
      projectId = parsed.project_id || 'unknown'
    } catch {}

    const map = this.getAllCredentials()
    
    let encryptedStr = ''
    if (safeStorage.isEncryptionAvailable()) {
      encryptedStr = safeStorage.encryptString(serviceAccountJson).toString('base64')
    } else {
      encryptedStr = Buffer.from(serviceAccountJson).toString('base64')
    }
    
    map[projectId] = encryptedStr
    store.set('firebaseProjects', map)
    store.delete('firebaseCredentials') // wipe legacy
    return true
  }

  static getAllCredentials(): Record<string, string> {
    const data = store.get('firebaseProjects') as Record<string, string>
    return data || {}
  }

  static getCredentialsForProject(projectId: string): string | null {
    const map = this.getAllCredentials()
    const data = map[projectId]
    if (!data) return null
    
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const buffer = Buffer.from(data, 'base64')
        return safeStorage.decryptString(buffer)
      }
      return Buffer.from(data, 'base64').toString('utf8')
    } catch (err) {
      console.error('Failed to decrypt credentials for project', err)
      return null
    }
  }

  static getSavedProjects(): string[] {
    const map = this.getAllCredentials()
    const keys = Object.keys(map)
    // Filter out unknown legacy parses just in case
    return keys.filter(k => k !== 'unknown')
  }

  static clearCredentials(): void {
    store.delete('firebaseProjects')
  }

  static saveApiKey(key: string): void {
    if (safeStorage.isEncryptionAvailable()) {
      store.set('openaiApiKey', safeStorage.encryptString(key).toString('base64'))
    } else {
      store.set('openaiApiKey', Buffer.from(key).toString('base64'))
    }
  }

  static getApiKey(): string | null {
    const data = store.get('openaiApiKey') as string
    if (!data) return null
    try {
      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(Buffer.from(data, 'base64'))
      }
      return Buffer.from(data, 'base64').toString('utf8')
    } catch {
      return null
    }
  }

  static hasApiKey(): boolean {
    return !!store.get('openaiApiKey')
  }
}
