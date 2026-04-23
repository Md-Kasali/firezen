import * as adminModule from 'firebase-admin'
import { SecureStore } from './secure-store'
import { parseFql } from './fql-parser'

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

  static async bulkDelete(collectionName: string, docIds: string[]): Promise<{ deleted: number }> {
    if (admin.apps.length === 0) throw new Error('Firebase not initialized')
    const db = admin.firestore()
    const CHUNK_SIZE = 500
    let deleted = 0

    for (let i = 0; i < docIds.length; i += CHUNK_SIZE) {
      const chunk = docIds.slice(i, i + CHUNK_SIZE)
      const batch = db.batch()
      chunk.forEach(id => {
        batch.delete(db.collection(collectionName).doc(id))
      })
      await batch.commit()
      deleted += chunk.length
    }

    return { deleted }
  }

  static async bulkUpdateField(
    collectionName: string,
    docIds: string[],
    fieldName: string,
    newValue: any
  ): Promise<{ updated: number }> {
    if (admin.apps.length === 0) throw new Error('Firebase not initialized')
    const db = admin.firestore()
    const CHUNK_SIZE = 500
    let updated = 0

    for (let i = 0; i < docIds.length; i += CHUNK_SIZE) {
      const chunk = docIds.slice(i, i + CHUNK_SIZE)
      const batch = db.batch()
      chunk.forEach(id => {
        batch.update(db.collection(collectionName).doc(id), { [fieldName]: newValue })
      })
      await batch.commit()
      updated += chunk.length
    }

    return { updated }
  }

  static async createDocument(collectionName: string, data: any, docId?: string): Promise<{ id: string }> {
    if (admin.apps.length === 0) throw new Error('Firebase not initialized')
    const db = admin.firestore()
    if (docId && docId.trim()) {
      await db.collection(collectionName).doc(docId.trim()).set(data)
      return { id: docId.trim() }
    }
    const ref = await db.collection(collectionName).add(data)
    return { id: ref.id }
  }

  static async updateDocument(
    collectionName: string,
    docId: string,
    data: any,
    fieldsToDelete: string[] = []
  ): Promise<void> {
    if (admin.apps.length === 0) throw new Error('Firebase not initialized')
    const db = admin.firestore()
    const { id: _id, ...payload } = data // strip client-side 'id' field

    // When fields need to be deleted, we can't rely on FieldValue.deleteField()
    // due to ESM bundling in electron-vite. Instead, read the doc, strip the keys, then set().
    if (fieldsToDelete.length > 0) {
      const docRef = db.collection(collectionName).doc(docId)
      const snap = await docRef.get()
      const existing = snap.data() || {}

      for (const field of fieldsToDelete) {
        delete existing[field]
      }

      await docRef.set({ ...existing, ...payload })
    } else {
      await db.collection(collectionName).doc(docId).update(payload)
    }
  }

  static async executeFqlQuery(collectionName: string, fqlString: string) {
    if (admin.apps.length === 0) throw new Error('Firebase not initialized')
    const parsed = parseFql(fqlString)
    if (parsed.error) throw new Error(parsed.error)

    const db = admin.firestore()
    let query: admin.firestore.Query = db.collection(collectionName)

    for (const filter of parsed.filters) {
      query = query.where(filter.field, filter.operator, filter.value)
    }
    if (parsed.orderBy) {
      query = query.orderBy(parsed.orderBy.field, parsed.orderBy.direction)
    }

    const snapshot = await query.limit(parsed.limit).get()
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

  static async exportAllCollections(): Promise<Record<string, any[]>> {
    if (admin.apps.length === 0) throw new Error('Firebase not initialized')
    const db = admin.firestore()
    const colRefs = await db.listCollections()
    const result: Record<string, any[]> = {}

    for (const colRef of colRefs) {
      const snapshot = await colRef.get()
      result[colRef.id] = snapshot.docs.map(doc => {
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
    return result
  }

  static async importCollection(
    collectionName: string,
    docs: Array<{ id?: string; [key: string]: any }>
  ): Promise<{ imported: number; skipped: number }> {
    if (admin.apps.length === 0) throw new Error('Firebase not initialized')
    const db = admin.firestore()
    const CHUNK_SIZE = 500
    let imported = 0
    let skipped = 0

    const validDocs = docs.filter(d => d && typeof d === 'object')
    skipped = docs.length - validDocs.length

    for (let i = 0; i < validDocs.length; i += CHUNK_SIZE) {
      const chunk = validDocs.slice(i, i + CHUNK_SIZE)
      const batch = db.batch()
      for (const doc of chunk) {
        const { id, ...data } = doc
        const ref = id
          ? db.collection(collectionName).doc(String(id))
          : db.collection(collectionName).doc()
        batch.set(ref, data)
      }
      await batch.commit()
      imported += chunk.length
    }

    return { imported, skipped }
  }
}
