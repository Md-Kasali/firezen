import React, { useEffect, useState } from 'react'
import { QueryBuilder } from './QueryBuilder'
import { DataGrid } from './DataGrid'
import { Database, Settings, X } from 'lucide-react'

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

  // 3. Auto-execute default query when activeCollection changes
  useEffect(() => {
     setResults([])
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
     try {
       const docs = await window.api.executeQuery(activeCollection, filters, limit)
       setResults(docs)
     } catch (err) {
       console.error("Query failed", err)
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
              <QueryBuilder collectionName={activeCollection} onExecute={handleExecuteQuery} />
              
              <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--text-color-mute)' }}>
                 {results.length > 0 && !loading && `Displaying top ${results.length} records. Modify the limit in the constructor to view more.`}
              </div>

              <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                 {loading ? (
                    <div style={{ padding: '24px', opacity: 0.5, textAlign: 'center' }}>Executing Query...</div>
                 ) : (
                    <DataGrid data={results} />
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
    </div>
  )
}
