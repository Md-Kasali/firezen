import React, { useEffect, useRef, useState } from 'react'
import { useTheme } from './ThemeProvider'
import { QueryBuilder } from './QueryBuilder'
import { DataGrid } from './DataGrid'
import { BulkActionBar } from './BulkActionBar'
import { FqlEditor } from './FqlEditor'
import { DocumentEditor } from './DocumentEditor'
import { Database, Settings, X, Table2, Braces, Plus, Upload, Download, FileText, CheckCircle2, AlertCircle, Sparkles, Loader2, LayoutList, Moon, Sun, Palette } from 'lucide-react'

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
  const [queryMode, setQueryMode] = useState<'visual' | 'advanced' | 'ai'>('visual')
  const [viewMode, setViewMode] = useState<'table' | 'json' | 'schema'>('table')
  const [editingDoc, setEditingDoc] = useState<{ mode: 'create' | 'edit'; doc?: any } | null>(null)

  // AI Generate state
  const [hasApiKey, setHasApiKey] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // Toolbar state
  const [showImportModal, setShowImportModal] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { theme, setTheme } = useTheme()
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'appearance' | 'ai'>('appearance')
  const [apiKeyInput, setApiKeyInput] = useState('')

  // 1. Initial Load: Get assigned projects & identify active
  useEffect(() => {
     window.api.getSavedProjects().then(setProjects).catch(console.error)
     window.api.connect().then(res => {
        if (res.success && res.projectId) setCurrentProject(res.projectId)
     })
     window.api.ai.hasApiKey().then(setHasApiKey).catch(() => setHasApiKey(false))
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
    window.location.reload()
  }

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || !activeCollection || aiLoading) return
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await window.api.ai.parseQuery(aiPrompt.trim(), schema)
      if (!res.success) {
        setAiError(res.error || 'AI failed to parse query.')
        return
      }
      setLoading(true)
      setSelectedIds([])
      const docs = await window.api.executeQuery(activeCollection, res.filters, 50)
      setResults(docs)
    } catch (err: any) {
      setAiError(err.message || 'Unexpected error.')
    } finally {
      setAiLoading(false)
      setLoading(false)
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExportLoading(true)
    try {
      const res = await window.api.exportAllCollections()
      if (!res.success) { alert('Export failed: ' + res.error); return }
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `firezen-export-${currentProject}-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert('Export error: ' + err.message)
    } finally {
      setExportLoading(false)
    }
  }

  // ── Import ────────────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setImportJson((ev.target?.result as string) || '')
    reader.readAsText(file)
    e.target.value = '' // reset so same file can be re-selected
  }

  const handleImport = async () => {
    setImportStatus(null)
    if (!importJson.trim()) { setImportStatus({ type: 'error', message: 'Paste or load a JSON file first.' }); return }
    let parsed: Record<string, any[]>
    try {
      parsed = JSON.parse(importJson)
    } catch {
      setImportStatus({ type: 'error', message: 'Invalid JSON – please check your file.' })
      return
    }
    // Validate top-level is an object whose values are arrays
    const entries = Object.entries(parsed)
    if (entries.length === 0 || !entries.every(([, v]) => Array.isArray(v))) {
      setImportStatus({ type: 'error', message: 'JSON must be an object: { "collectionName": [ {…} ] }' })
      return
    }
    setImportLoading(true)
    let totalImported = 0
    const errors: string[] = []
    for (const [colName, docs] of entries) {
      const res = await window.api.importCollection(colName, docs)
      if (res.success) {
        totalImported += res.imported
      } else {
        errors.push(`${colName}: ${res.error}`)
      }
    }
    setImportLoading(false)
    if (errors.length) {
      setImportStatus({ type: 'error', message: `Partial import. Errors:\n${errors.join('\n')}` })
    } else {
      setImportStatus({ type: 'success', message: `Successfully imported ${totalImported} document(s) across ${entries.length} collection(s).` })
      // Refresh if the current collection was among those imported
      if (activeCollection && entries.some(([n]) => n === activeCollection)) {
        handleExecuteQuery([], 50)
      }
      // Refresh collection list in case new collections were added
      window.api.listCollections().then(cols => {
        setCollections(cols)
      })
    }
  }

  const closeImportModal = () => {
    setShowImportModal(false)
    setImportJson('')
    setImportStatus(null)
  }

  return (
    <div className="main-content" style={{ flexDirection: 'column' }}>
      {/* ── Import Modal ─────────────────────────────────────────────────── */}
      {showImportModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.55)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)'
        }}>
          <div className="glass-panel" style={{
            width: '540px', maxHeight: '80vh',
            padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Upload size={16} style={{ color: 'var(--accent-color)' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Import Collection</h3>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-color-mute)' }}>Paste or load a JSON file to import documents</p>
                </div>
              </div>
              <button onClick={closeImportModal} style={{ color: 'var(--text-color-mute)', padding: 4 }}><X size={20} /></button>
            </div>

            {/* Format hint */}
            <div style={{ background: 'var(--bg-color-soft)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-color-soft)', borderLeft: '3px solid var(--accent-color)' }}>
              <strong>Expected format:</strong>
              <pre style={{ margin: '4px 0 0', fontFamily: 'monospace', fontSize: 11, opacity: 0.85 }}>{`{ "collectionName": [ { "field": "value" } ] }`}</pre>
            </div>

            {/* File loader */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '8px 16px', borderRadius: 7,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-color-soft)',
                  color: 'var(--text-color-soft)',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <FileText size={14} /> Choose File
              </button>
              <input ref={fileInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleFileSelect} />
              <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--text-color-mute)', opacity: 0.7 }}>or paste JSON below</span>
            </div>

            {/* JSON textarea */}
            <textarea
              value={importJson}
              onChange={e => setImportJson(e.target.value)}
              placeholder={'{\n  "users": [\n    { "id": "uid1", "name": "Alice" }\n  ]\n}'}
              style={{
                width: '100%', minHeight: 180, resize: 'vertical',
                padding: '12px', borderRadius: 8,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-color)', color: 'var(--text-color)',
                fontFamily: '"JetBrains Mono", monospace', fontSize: 12,
                lineHeight: 1.6, outline: 'none',
                transition: 'border-color 0.15s'
              }}
            />

            {/* Status */}
            {importStatus && (
              <div style={{
                display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px',
                borderRadius: 8, fontSize: 13,
                background: importStatus.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${importStatus.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                color: importStatus.type === 'success' ? '#22c55e' : '#ef4444'
              }}>
                {importStatus.type === 'success'
                  ? <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  : <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />}
                <span style={{ whiteSpace: 'pre-wrap' }}>{importStatus.message}</span>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={closeImportModal} style={{ padding: '9px 20px', borderRadius: 7, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-color-soft)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importLoading}
                style={{
                  padding: '9px 22px', borderRadius: 7, border: 'none',
                  background: importLoading ? 'var(--bg-color-mute)' : 'var(--accent-color)',
                  color: importLoading ? 'var(--text-color-mute)' : 'var(--accent-fg)',
                  fontSize: 13, fontWeight: 600, cursor: importLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 7,
                  transition: 'all 0.15s'
                }}
              >
                <Upload size={14} />
                {importLoading ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Modal ───────────────────────────────────────────────── */}
      {showSettings && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel" style={{ width: '460px', padding: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(var(--accent-rgb, 245,158,11),0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Settings size={16} style={{ color: 'var(--accent-color)' }} />
                </div>
                <h3 style={{ margin: 0, fontSize: 16 }}>Settings</h3>
              </div>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: 'var(--text-color-mute)', cursor: 'pointer', padding: 4 }}><X size={20} /></button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, padding: '0 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-color-soft)' }}>
              {([['appearance', <Palette size={13} />, 'Appearance'], ['ai', <Sparkles size={13} />, 'AI Configuration']] as const).map(([tab, icon, label]) => (
                <button
                  key={tab}
                  onClick={() => setSettingsTab(tab)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '12px 16px', border: 'none', background: 'transparent',
                    borderBottom: settingsTab === tab ? '2px solid var(--accent-color)' : '2px solid transparent',
                    color: settingsTab === tab ? 'var(--accent-color)' : 'var(--text-color-mute)',
                    fontWeight: settingsTab === tab ? 600 : 400,
                    fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                    marginBottom: -1,
                  }}
                >
                  {icon}{label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {settingsTab === 'appearance' ? (
                <>
                  <div>
                    <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-color-mute)' }}>Choose how Firezen looks to you.</p>
                    <div style={{ display: 'flex', gap: 12 }}>
                      {(['dark', 'light'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setTheme(t)}
                          style={{
                            flex: 1, padding: '16px 12px',
                            borderRadius: 10,
                            border: theme === t ? '2px solid var(--accent-color)' : '2px solid var(--border-color)',
                            background: theme === t ? 'rgba(245,158,11,0.06)' : 'var(--bg-color-soft)',
                            cursor: 'pointer', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', gap: 10,
                            transition: 'all 0.18s',
                          }}
                        >
                          <div style={{
                            width: 40, height: 40, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: t === 'dark' ? '#1e293b' : '#f1f5f9',
                            border: '1px solid var(--border-color)',
                          }}>
                            {t === 'dark'
                              ? <Moon size={18} style={{ color: '#94a3b8' }} />
                              : <Sun size={18} style={{ color: '#f59e0b' }} />}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: theme === t ? 600 : 400, color: theme === t ? 'var(--accent-color)' : 'var(--text-color-soft)' }}>
                            {t === 'dark' ? 'Dark' : 'Light'}
                          </span>
                          {theme === t && (
                            <span style={{ fontSize: 10, color: 'var(--accent-color)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Active</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: 13, fontWeight: 600, color: 'var(--text-color-soft)' }}>
                      OpenAI API Key <span style={{ opacity: 0.5, fontWeight: 400 }}>(used for AI Generate queries)</span>
                    </label>
                    <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-color-mute)', opacity: 0.8 }}>
                      Your key is stored encrypted using Electron's safeStorage and never leaves your machine.
                    </p>
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={e => setApiKeyInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveApiKey()}
                      placeholder="sk-..."
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', outline: 'none', fontSize: 13, boxSizing: 'border-box' }}
                    />
                  </div>
                  <button
                    onClick={handleSaveApiKey}
                    style={{ padding: '10px', background: 'var(--accent-color)', color: 'var(--accent-fg)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13, transition: 'opacity 0.15s' }}
                  >
                    Save Securely
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        padding: '5px 12px',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-color-soft)',
        flexShrink: 0
      }}>


        {/* Import */}
        <button
          id="toolbar-import"
          onClick={() => { setImportStatus(null); setShowImportModal(true) }}
          data-tooltip="Import from JSON"
          className="toolbar-btn"
        >
          <Upload size={16} />
        </button>

        {/* Export */}
        <button
          id="toolbar-export"
          onClick={handleExport}
          disabled={exportLoading}
          data-tooltip={exportLoading ? 'Exporting…' : 'Export all to JSON'}
          className={`toolbar-btn${exportLoading ? ' toolbar-btn--disabled' : ''}`}
        >
          <Download size={16} />
        </button>
      </div>

      {/* ── Main layout (sidebar + workspace) ───────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

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
                   {(['visual', 'advanced', 'ai'] as const).map(m => {
                     const isAi = m === 'ai'
                     const disabled = isAi && !hasApiKey
                     const active = queryMode === m
                     return (
                       <button
                         key={m}
                         onClick={() => !disabled && setQueryMode(m)}
                         disabled={disabled}
                         title={disabled ? 'Configure an OpenAI API key in Settings to enable AI Generate' : undefined}
                         style={{
                           display: 'flex', alignItems: 'center', gap: 5,
                           padding: '4px 14px', borderRadius: 4, border: 'none',
                           background: active ? (isAi ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'var(--accent-color)') : 'transparent',
                            color: active ? (isAi ? 'white' : 'var(--accent-fg)') : disabled ? 'var(--text-color-mute)' : 'var(--text-color-soft)',
                           fontWeight: active ? 600 : 400, fontSize: 13,
                           cursor: disabled ? 'not-allowed' : 'pointer',
                           opacity: disabled ? 0.45 : 1,
                           transition: 'all 0.15s',
                         }}
                       >
                         {isAi && <Sparkles size={12} />}
                         {m === 'visual' ? 'Visual' : m === 'advanced' ? 'Advanced FQL' : 'AI Generate'}
                       </button>
                     )
                   })}
                 </div>
                 <span style={{ fontSize: 12, color: 'var(--text-color-mute)', opacity: 0.7 }}>
                   {queryMode === 'advanced' ? 'Write FQL queries directly with autocomplete'
                     : queryMode === 'ai' ? 'Describe your query in plain English'
                     : 'Build queries visually with row filters'}
                 </span>
                 {queryMode === 'ai' && !hasApiKey && (
                   <span style={{ fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, padding: '2px 8px' }}>
                     No API key — configure in Settings
                   </span>
                 )}
                 <span style={{ flex: 1 }} />
              </div>

              {/* Query Mode */}
              {queryMode === 'visual' ? (
                <QueryBuilder collectionName={activeCollection} onExecute={handleExecuteQuery} />
              ) : queryMode === 'advanced' ? (
                <div className="glass-panel" style={{ padding: 20, marginBottom: 16 }}>
                  <FqlEditor schema={schema} onExecute={handleFqlExecute} isLoading={loading} />
                </div>
              ) : (
                /* AI Generate panel */
                <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(168,85,247,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Sparkles size={14} style={{ color: '#a855f7' }} />
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>AI Generate</span>
                    <span style={{ fontSize: 12, color: 'var(--text-color-mute)', opacity: 0.7 }}>Describe what you want to query in plain English</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      id="ai-prompt-input"
                      type="text"
                      value={aiPrompt}
                      onChange={e => { setAiPrompt(e.target.value); setAiError(null) }}
                      onKeyDown={e => e.key === 'Enter' && handleAiGenerate()}
                      placeholder={`e.g. "Show active users with score greater than 5 ordered by name"`}
                      disabled={aiLoading}
                      style={{
                        flex: 1,
                        padding: '9px 14px',
                        borderRadius: 8,
                        border: aiError ? '1.5px solid #ef4444' : '1px solid var(--border-color)',
                        background: 'var(--bg-color)',
                        color: 'var(--text-color)',
                        fontSize: 13,
                        outline: 'none',
                        transition: 'border-color 0.15s',
                        fontFamily: 'inherit',
                      }}
                    />
                    <button
                      id="ai-generate-btn"
                      onClick={handleAiGenerate}
                      disabled={aiLoading || !aiPrompt.trim()}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        padding: '9px 20px', borderRadius: 8, border: 'none',
                        background: (aiLoading || !aiPrompt.trim()) ? 'var(--bg-color-soft)' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
                        color: (aiLoading || !aiPrompt.trim()) ? 'var(--text-color-mute)' : 'white',
                        fontWeight: 600, fontSize: 13,
                        cursor: (aiLoading || !aiPrompt.trim()) ? 'not-allowed' : 'pointer',
                        transition: 'all 0.18s',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {aiLoading
                        ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
                        : <><Sparkles size={14} /> Generate</>}
                    </button>
                  </div>
                  {aiError && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '9px 14px', borderRadius: 7, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 13, color: '#ef4444' }}>
                      <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>{aiError}</span>
                    </div>
                  )}
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

              {/* Data View: Table / JSON / Schema toggle */}
               <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                 <div style={{ display: 'flex', background: 'var(--bg-color-soft)', borderRadius: 6, padding: 3, border: '1px solid var(--border-color)' }}>
                   {(['table', 'json', 'schema'] as const).map(v => (
                     <button
                       key={v}
                       onClick={() => setViewMode(v)}
                       style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 12px', borderRadius: 4, border: 'none', background: viewMode === v ? 'var(--accent-color)' : 'transparent', color: viewMode === v ? 'var(--accent-fg)' : 'var(--text-color-soft)', fontWeight: viewMode === v ? 600 : 400, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' }}
                     >
                       {v === 'table' ? <><Table2 size={13} /> Table</> : v === 'json' ? <><Braces size={13} /> JSON</> : <><LayoutList size={13} /> Schema</>}
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

              <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
                 {loading ? (
                    <div style={{ padding: '24px', opacity: 0.5, textAlign: 'center' }}>Executing Query...</div>
                 ) : viewMode === 'table' ? (
                    <DataGrid
                      data={results}
                      onSelectionChange={setSelectedIds}
                      onEditRow={doc => setEditingDoc({ mode: 'edit', doc })}
                    />
                 ) : viewMode === 'json' ? (
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
                 ) : (
                    /* Schema view */
                    <div style={{ overflow: 'auto', flex: 1, padding: '20px' }}>
                      {schema.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-color-mute)', padding: '32px' }}>No schema available. Select a collection with data.</div>
                      ) : (
                        <>
                          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <LayoutList size={16} style={{ color: 'var(--accent-color)' }} />
                            <span style={{ fontWeight: 600, fontSize: 15 }}>Schema</span>
                            <span style={{ fontSize: 12, color: 'var(--text-color-mute)', opacity: 0.7 }}>— {activeCollection} · {schema.length} field{schema.length !== 1 ? 's' : ''} · sampled from up to 50 documents</span>
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                {['Field', 'Type', 'Sample Values'].map(h => (
                                  <th key={h} style={{ textAlign: 'left', padding: '8px 14px', fontWeight: 600, color: 'var(--text-color-mute)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {[...schema].sort((a, b) => {
                                if (a.name === 'id') return -1
                                if (b.name === 'id') return 1
                                return a.name.localeCompare(b.name)
                              }).map((field, i) => {
                                const typeColors: Record<string, { bg: string; color: string }> = {
                                  string:    { bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa' },
                                  number:    { bg: 'rgba(16,185,129,0.12)',  color: '#34d399' },
                                  boolean:   { bg: 'rgba(245,158,11,0.12)',  color: '#fbbf24' },
                                  timestamp: { bg: 'rgba(139,92,246,0.12)',  color: '#a78bfa' },
                                  array:     { bg: 'rgba(236,72,153,0.12)',  color: '#f472b6' },
                                  object:    { bg: 'rgba(99,102,241,0.12)',  color: '#818cf8' },
                                  reference: { bg: 'rgba(234,179,8,0.12)',   color: '#eab308' },
                                  geopoint:  { bg: 'rgba(20,184,166,0.12)',  color: '#2dd4bf' },
                                  null:      { bg: 'rgba(156,163,175,0.12)', color: '#9ca3af' },
                                }
                                const tc = typeColors[field.type] ?? { bg: 'rgba(156,163,175,0.12)', color: '#9ca3af' }
                                return (
                                  <tr key={field.name} style={{ borderBottom: '1px solid var(--border-color)', background: i % 2 === 1 ? 'var(--bg-color-soft)' : 'transparent' }}>
                                    <td style={{ padding: '10px 14px', fontFamily: '"JetBrains Mono", monospace', fontSize: 13, fontWeight: 500 }}>{field.name}</td>
                                    <td style={{ padding: '10px 14px' }}>
                                      <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', background: tc.bg, color: tc.color }}>
                                        {field.type}
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                        {(field as any).sampleValues?.slice(0, 5).map((sv: any, si: number) => (
                                          <span key={si} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: 'var(--bg-color-soft)', border: '1px solid var(--border-color)', color: 'var(--text-color-soft)', fontFamily: '"JetBrains Mono", monospace', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
                                            {String(sv)}
                                          </span>
                                        ))}
                                        {((field as any).sampleValues?.length ?? 0) === 0 && (
                                          <span style={{ fontSize: 11, color: 'var(--text-color-mute)', opacity: 0.5, fontStyle: 'italic' }}>—</span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </>
                      )}
                    </div>
                 )}

                 {/* ── Floating New Document Button ──────────────────────── */}
                 <button
                   id="fab-new-document"
                   onClick={() => setEditingDoc({ mode: 'create' })}
                   title="New Document"
                   style={{
                     position: 'absolute',
                     bottom: 20,
                     right: 20,
                     width: 48,
                     height: 48,
                     borderRadius: '50%',
                     border: 'none',
                     background: 'var(--accent-color)',
                     color: 'var(--accent-fg)',
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     cursor: 'pointer',
                     boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
                     transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                     zIndex: 10,
                   }}
                   onMouseEnter={e => {
                     const btn = e.currentTarget
                     btn.style.transform = 'scale(1.12)'
                     btn.style.boxShadow = '0 6px 28px rgba(0,0,0,0.45)'
                   }}
                   onMouseLeave={e => {
                     const btn = e.currentTarget
                     btn.style.transform = 'scale(1)'
                     btn.style.boxShadow = '0 4px 20px rgba(0,0,0,0.35)'
                   }}
                 >
                   <Plus size={22} />
                 </button>
              </div>
            </>
         ) : (
            <div className="glass-panel" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <h2>Connected to: {currentProject}</h2>
              <p style={{ color: 'var(--text-color-mute)' }}>Select a collection to begin.</p>
            </div>
         )}
       </div>

      </div>{/* end sidebar+workspace wrapper */}

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
