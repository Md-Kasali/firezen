import React, { useEffect, useState } from 'react'
import { QueryBuilder } from './QueryBuilder'
import { DataGrid } from './DataGrid'
import { BulkActionBar } from './BulkActionBar'
import { FqlEditor } from './FqlEditor'
import { DocumentEditor } from './DocumentEditor'
import { Database, Settings, X, Table2, Braces, Plus } from 'lucide-react'

interface DashboardProps {
  onAddProject: () => void
}

export const Dashboard: React.FC<DashboardProps> = ({ onAddProject }) => {
  const [projects, setProjects] = useState<string[]>([])
  const [currentProject, setCurrentProject] = useState<string>('')
  
  const [collections, setCollections] = useState<Array<{ id: string }>>([])
  const [activeCollection, setActiveCollection] = useState<string | null>(null)
  
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [schema, setSchema] = useState<Array<{ name: string; type: string }>>([])  
  const [queryMode, setQueryMode] = useState<'visual' | 'advanced'>('visual')
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table')
  const [editingDoc, setEditingDoc] = useState<{ mode: 'create' | 'edit'; doc?: any } | null>(null)

  const [showSettings, setShowSettings] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')

  // 1. Initial Load: Get assigned projects & identify active
  useEffect(() => {
     window.api.getSavedProjects().then(setProjects).catch(console.error)
     window.api.connect().then(res => {
        if (res.success && res.projectId) setCurrentProject(res.projectId)
     })
  }, [])

  // 2. Fetch Collections when target project resolves
  useEffect(() => {
    if (!currentProject) return
    window.api.listCollections().then(cols => {
       setCollections(cols)
       if (cols.length > 0) setActiveCollection(cols[0].id)
       else setActiveCollection(null)
    }).catch(console.error)
  }, [currentProject])

  // 2b. Fetch schema when collection changes for BulkActionBar field list
  useEffect(() => {
    if (!activeCollection) return
    window.api.sampleCollectionSchema(activeCollection)
      .then(setSchema)
      .catch(console.error)
  }, [activeCollection])

  // 3. Auto-execute default query when activeCollection changes
  useEffect(() => {
     setResults([])
     setSelectedIds([])
     if (activeCollection) {
        handleExecuteQuery([], 50)
     }
  }, [activeCollection])

  const handleSwitchProject = async (e: React.ChangeEvent<HTMLSelectElement>) => {
     const target = e.target.value
     if (target === 'ADD_NEW') {
        onAddProject() // Gracefully return to AuthScreen
        return
     }
     const res = await window.api.connect({ projectId: target })
     if (res.success) {
        setCurrentProject(target)
     } else {
        alert("Switch failed: " + res.error)
     }
  }

  const handleExecuteQuery = async (filters: any[], limit: number) => {
     if (!activeCollection) return
     setLoading(true)
     setSelectedIds([])
     try {
       const docs = await window.api.executeQuery(activeCollection, filters, limit)
       setResults(docs)
     } catch (err) {
       console.error("Query failed", err)
     } finally {
       setLoading(false)
     }
  }

  const handleFqlExecute = async (fqlString: string) => {
     if (!activeCollection) return
     setLoading(true)
     setSelectedIds([])
     try {
       const res = await window.api.executeFqlQuery(activeCollection, fqlString)
       if (res.success) {
         setResults(res.docs || [])
       } else {
         alert('FQL Error: ' + res.error)
       }
     } catch (err: any) {
       alert('FQL Error: ' + err.message)
     } finally {
       setLoading(false)
     }
  }

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return
    await window.api.ai.setApiKey(apiKeyInput.trim())
    setShowSettings(false)
    setApiKeyInput('')
    window.location.reload() // Naive refresh to enforce components re-evaluating hasApiKey
  }

  return (
    <div className="main-content">
      {/* Settings Modal */}
      {showSettings && (
         <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
            <div className="glass-panel" style={{ width: '400px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0 }}>API Connections</h3>
                  <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: 'var(--text-color)', cursor: 'pointer' }}><X size={20} /></button>
               </div>
               <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-color-soft)' }}>OpenAI API Key <span style={{opacity: 0.5}}>(for AI queries)</span></label>
                  <input type="password" value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} placeholder="sk-..." style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', outline: 'none' }} />
               </div>
               <button onClick={handleSaveApiKey} style={{ padding: '10px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Save Securely</button>
            </div>
         </div>
      )}

      <div className="sidebar animate-fade-in" style={{ width: '240px', display: 'flex', flexDirection: 'column' }}>
        
        {/* Project Switcher Area */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
           <Database size={16} style={{ color: 'var(--accent-color)' }} />
           <select 
              value={currentProject} 
              onChange={handleSwitchProject}
              style={{ flex: 1, padding: '6px', background: 'var(--bg-color)', color: 'var(--text-color)', border: '1px solid var(--border-color)', borderRadius: '4px', outline: 'none' }}
           >
              {projects.map(p => <option key={p} value={p}>{p}</option>)}
              <option value="ADD_NEW">-- Add Project --</option>
           </select>
        </div>

        <div className="sidebar-header">Collections</div>
        <div className="collection-list" style={{ flex: 1, overflowY: 'auto' }}>
           {collections.length === 0 ? (
               <div style={{ padding: '10px 12px', fontSize: '13px', opacity: 0.5 }}>No collections found</div>
           ) : (
             collections.map(col => (
               <div 
                 key={col.id} 
                 className={`collection-item ${activeCollection === col.id ? 'active' : ''}`}
                 onClick={() => setActiveCollection(col.id)}
               >
                 {col.id}
               </div>
             ))
           )}
        </div>

        {/* Settings Footer */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
           <button onClick={() => setShowSettings(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-color-soft)', cursor: 'pointer', width: '100%' }}>
              <Settings size={16} />
              <span style={{ fontSize: '14px', fontWeight: 500 }}>Settings</span>
           </button>
        </div>
      </div>

      <div className="workspace animate-fade-in" style={{ display: 'flex', flexDirection: 'column' }}>
         {activeCollection ? (
            <>
              {/* Mode Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                 <div style={{ display: 'flex', background: 'var(--bg-color-soft)', borderRadius: 6, padding: 3, border: '1px solid var(--border-color)' }}>
                   {(['visual', 'advanced'] as const).map(m => (
                     <button
                       key={m}
                       onClick={() => setQueryMode(m)}
                       style={{ padding: '4px 14px', borderRadius: 4, border: 'none', background: queryMode === m ? 'var(--accent-color)' : 'transparent', color: queryMode === m ? 'white' : 'var(--text-color-soft)', fontWeight: queryMode === m ? 600 : 400, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' }}
                     >
                       {m === 'visual' ? 'Visual' : 'Advanced FQL'}
                     </button>
                   ))}
                 </div>
                 <span style={{ fontSize: 12, color: 'var(--text-color-mute)', opacity: 0.7 }}>
                   {queryMode === 'advanced' ? 'Write FQL queries directly with autocomplete' : 'Build queries visually with row filters'}
                 </span>
                 <span style={{ flex: 1 }} />
                 {/* New Document button */}
                 <button
                   onClick={() => setEditingDoc({ mode: 'create' })}
                   style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 6, border: 'none', background: 'var(--accent-color)', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                 >
                   <Plus size={14} /> New Document
                 </button>
              </div>

              {/* Query Mode */}
              {queryMode === 'visual' ? (
                <QueryBuilder collectionName={activeCollection} onExecute={handleExecuteQuery} />
              ) : (
                <div className="glass-panel" style={{ padding: 20, marginBottom: 16 }}>
                  <FqlEditor schema={schema} onExecute={handleFqlExecute} isLoading={loading} />
                </div>
              )}
              
              <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--text-color-mute)' }}>
                 {results.length > 0 && !loading && `Displaying top ${results.length} records. Modify the limit in the constructor to view more.`}
              </div>

              {selectedIds.length > 0 && activeCollection && (
                <BulkActionBar
                  selectedCount={selectedIds.length}
                  selectedIds={selectedIds}
                  collectionName={activeCollection}
                  schemaFields={schema}
                  onComplete={() => {
                    setSelectedIds([])
                    handleExecuteQuery([], 50)
                  }}
                />
              )}

              {/* Data View: Table / JSON toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                 <div style={{ display: 'flex', background: 'var(--bg-color-soft)', borderRadius: 6, padding: 3, border: '1px solid var(--border-color)' }}>
                   {(['table', 'json'] as const).map(v => (
                     <button
                       key={v}
                       onClick={() => setViewMode(v)}
                       style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 12px', borderRadius: 4, border: 'none', background: viewMode === v ? 'var(--accent-color)' : 'transparent', color: viewMode === v ? 'white' : 'var(--text-color-soft)', fontWeight: viewMode === v ? 600 : 400, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' }}
                     >
                       {v === 'table' ? <><Table2 size={13} /> Table</> : <><Braces size={13} /> JSON</>}
                     </button>
                   ))}
                 </div>
                 <span style={{ flex: 1 }} />
                 {results.length > 0 && !loading && (
                    <span style={{ fontSize: 12, color: 'var(--text-color-mute)', opacity: 0.7 }}>
                      {results.length} record{results.length !== 1 ? 's' : ''}
                    </span>
                 )}
              </div>

              <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                 {loading ? (
                    <div style={{ padding: '24px', opacity: 0.5, textAlign: 'center' }}>Executing Query...</div>
                 ) : viewMode === 'table' ? (
                    <DataGrid
                      data={results}
                      onSelectionChange={setSelectedIds}
                      onEditRow={doc => setEditingDoc({ mode: 'edit', doc })}
                    />
                 ) : (
                    <pre style={{
                      flex: 1,
                      margin: 0,
                      padding: '16px',
                      overflow: 'auto',
                      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                      fontSize: 12,
                      lineHeight: 1.6,
                      color: 'var(--text-color)',
                      whiteSpace: 'pre',
                    }}>
                      {JSON.stringify(results, null, 2)}
                    </pre>
                 )}
              </div>
            </>
         ) : (
            <div className="glass-panel" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <h2>Connected to: {currentProject}</h2>
              <p style={{ color: 'var(--text-color-mute)' }}>Select a collection to begin.</p>
            </div>
         )}
       </div>

      {/* Document Editor Modal */}
      {editingDoc && activeCollection && (
        <DocumentEditor
          mode={editingDoc.mode}
          doc={editingDoc.doc}
          schema={schema}
          collectionName={activeCollection}
          onSave={() => {
            setEditingDoc(null)
            handleExecuteQuery([], 50)
          }}
          onClose={() => setEditingDoc(null)}
        />
      )}
    </div>
  )
}
