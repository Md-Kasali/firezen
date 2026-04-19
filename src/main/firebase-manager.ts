import * as adminModule from 'firebase-admin'
import { SecureStore } from './secure-store'

const admin = (adminModule as any).default || adminModule

export class FirebaseManager {
  static async connect(projectId?: string, serviceAccountJson?: string): Promise<{ success: boolean; error?: string; projectId?: string }> {
    // If an app is running, check if it's the requested one. If not, delete it to swap connection.
    if (admin.apps.length > 0) {
      const activeApp = admin.app()
      if (activeApp.options.projectId === projectId && !serviceAccountJson) {
        return { success: true, projectId }
      }
      await activeApp.delete()
    }

    let credentialsJson = serviceAccountJson
    if (!credentialsJson && projectId) {
      credentialsJson = SecureStore.getCredentialsForProject(projectId) || ''
    } else if (!credentialsJson && !projectId) {
      // Auto-connect to the first one available on boot
      const saved = SecureStore.getSavedProjects()
      if (saved.length > 0) {
         projectId = saved[0]
         credentialsJson = SecureStore.getCredentialsForProject(projectId) || ''
      }
    }

    if (!credentialsJson) {
      return { success: false, error: 'No credentials provided or found in secure store.' }
    }

    try {
      const serviceAccount = JSON.parse(credentialsJson)
      const targetProjectId = serviceAccount.project_id || projectId
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: targetProjectId
      })
      
      if (serviceAccountJson) {
        SecureStore.saveCredentials(serviceAccountJson)
      }

      return { success: true, projectId: targetProjectId }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  static async listCollections(): Promise<Array<{ id: string; path: string }>> {
    if (admin.apps.length === 0) throw new Error('Firebase not initialized')
    
    const db = admin.firestore()
    const collections = await db.listCollections()
    return collections.map(col => ({ id: col.id, path: col.path }))
  }
  
  static async sampleCollectionSchema(collectionName: string) {
    if (admin.apps.length === 0) throw new Error('Firebase not initialized')
    const db = admin.firestore()
    const snapshot = await db.collection(collectionName).limit(50).get()
    
    const schema = new Map<string, { type: string; samples: Set<any> }>()
    
    snapshot.forEach(doc => {
      const data = doc.data()
      Object.entries(data).forEach(([key, value]) => {
        let type = typeof value
        if (value === null) type = 'null'
        else if (Array.isArray(value)) type = 'array'
        else if (value instanceof admin.firestore.Timestamp) type = 'timestamp'
        else if (value instanceof admin.firestore.GeoPoint) type = 'geopoint'
        else if (value instanceof admin.firestore.DocumentReference) type = 'reference'
        
        if (!schema.has(key)) {
          schema.set(key, { type, samples: new Set() })
        } else if (schema.get(key)!.type === 'null') {
          schema.get(key)!.type = type
        }
        
        // Collect sample values (strings, numbers, booleans only - skip complex types)
        const entry = schema.get(key)!
        if (entry.samples.size < 10 && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') && value !== null) {
          entry.samples.add(value)
        }
      })
    })

    return Array.from(schema.entries()).map(([name, { type, samples }]) => ({
      name,
      type,
      sampleValues: Array.from(samples)
    }))
  }

  static async executeQuery(collectionName: string, filters: Array<{ field: string, operator: any, value: any }>, queryLimit: number = 50) {
    if (admin.apps.length === 0) throw new Error('Firebase not initialized')
    const db = admin.firestore()
    
    let query: admin.firestore.Query = db.collection(collectionName)
    
    for (const filter of filters) {
      if (filter.field && filter.operator && filter.value !== undefined) {
         query = query.where(filter.field, filter.operator, filter.value)
      }
    }
    
    const snapshot = await query.limit(queryLimit).get()
    
    return snapshot.docs.map(doc => {
       const data = doc.data()
       for (const [key, value] of Object.entries(data)) {
          if (value instanceof admin.firestore.Timestamp) {
              data[key] = value.toDate().toISOString()
          } else if (value instanceof admin.firestore.DocumentReference) {
              data[key] = value.path
          }
       }
       return { id: doc.id, ...data }
    })
  }
  
  static async disconnect(): Promise<void> {
     if (admin.apps.length > 0) {
        await admin.app().delete()
     }
     SecureStore.clearCredentials()
  }
}
