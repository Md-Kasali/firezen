import React, { useState } from 'react'
import { Trash2, Edit3, X } from 'lucide-react'

interface BulkActionBarProps {
  selectedCount: number
  selectedIds: string[]
  collectionName: string
  schemaFields: Array<{ name: string; type: string }>
  onComplete: () => void
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  selectedIds,
  collectionName,
  schemaFields,
  onComplete,
}) => {
  const [modal, setModal] = useState<'delete' | 'update' | null>(null)
  const [fieldName, setFieldName] = useState(schemaFields[0]?.name || '')
  const [fieldValue, setFieldValue] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleDelete = async () => {
    setIsProcessing(true)
    try {
      const res = await window.api.bulkDelete(collectionName, selectedIds)
      if (res.error) {
        alert('Bulk delete failed: ' + res.error)
      } else {
        alert(`Successfully deleted ${res.deleted} document${res.deleted !== 1 ? 's' : ''}.`)
        onComplete()
      }
    } catch (err: any) {
      alert('Unexpected error: ' + err.message)
    } finally {
      setIsProcessing(false)
      setModal(null)
    }
  }

  const handleUpdate = async () => {
    if (!fieldName) return
    setIsProcessing(true)
    try {
      // Cast value intelligently based on field type
      const fieldType = schemaFields.find(f => f.name === fieldName)?.type
      let castedValue: any = fieldValue
      if (fieldType === 'number') castedValue = Number(fieldValue)
      if (fieldType === 'boolean') castedValue = fieldValue === 'true'
      if (fieldType === 'null' || fieldValue === 'null') castedValue = null

      const res = await window.api.bulkUpdateField(collectionName, selectedIds, fieldName, castedValue)
      if (res.error) {
        alert('Bulk update failed: ' + res.error)
      } else {
        alert(`Successfully updated ${res.updated} document${res.updated !== 1 ? 's' : ''}.`)
        onComplete()
      }
    } catch (err: any) {
      alert('Unexpected error: ' + err.message)
    } finally {
      setIsProcessing(false)
      setModal(null)
    }
  }

  return (
    <>
      {/* Confirmation Modals */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel" style={{ width: 420, padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {modal === 'delete' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0, color: '#ef4444' }}>Confirm Bulk Delete</h3>
                    <p style={{ margin: '8px 0 0', color: 'var(--text-color-mute)', fontSize: 14 }}>
                      This will permanently delete <strong>{selectedCount}</strong> document{selectedCount !== 1 ? 's' : ''} from <strong>{collectionName}</strong>. This cannot be undone.
                    </p>
                  </div>
                  <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-color-mute)', cursor: 'pointer', flexShrink: 0 }}><X size={20} /></button>
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button onClick={() => setModal(null)} style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'none', color: 'var(--text-color)', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleDelete} disabled={isProcessing} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#ef4444', color: 'white', fontWeight: 600, cursor: 'pointer', opacity: isProcessing ? 0.6 : 1 }}>
                    {isProcessing ? 'Deleting...' : `Delete ${selectedCount} doc${selectedCount !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </>
            )}

            {modal === 'update' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Update Field</h3>
                    <p style={{ margin: '8px 0 0', color: 'var(--text-color-mute)', fontSize: 14 }}>
                      Set a field value on <strong>{selectedCount}</strong> selected document{selectedCount !== 1 ? 's' : ''}.
                    </p>
                  </div>
                  <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-color-mute)', cursor: 'pointer', flexShrink: 0 }}><X size={20} /></button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-color-soft)' }}>Field</label>
                    <select value={fieldName} onChange={e => setFieldName(e.target.value)} style={inputStyle}>
                      {schemaFields.filter(f => f.name !== 'id').map(f => (
                        <option key={f.name} value={f.name}>{f.name} ({f.type})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-color-soft)' }}>New Value</label>
                    <input type="text" value={fieldValue} onChange={e => setFieldValue(e.target.value)} placeholder={`Enter new ${schemaFields.find(f => f.name === fieldName)?.type || 'value'}...`} style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button onClick={() => setModal(null)} style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'none', color: 'var(--text-color)', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleUpdate} disabled={isProcessing || !fieldName} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: 'var(--accent-color)', color: 'var(--accent-fg)', fontWeight: 600, cursor: 'pointer', opacity: isProcessing ? 0.6 : 1 }}>
                    {isProcessing ? 'Updating...' : `Update ${selectedCount} doc${selectedCount !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '10px 16px',
        background: 'var(--accent-color)',
        borderRadius: 8,
        marginBottom: 12,
        boxShadow: '0 4px 12px rgba(99,102,241,0.25)',
        animation: 'fadeIn 0.2s ease',
      }}>
        <span style={{ flex: 1, color: 'var(--accent-fg)', fontWeight: 600, fontSize: 14 }}>
          {selectedCount} row{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <button
          onClick={() => setModal('update')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: 'white', fontWeight: 500, cursor: 'pointer', backdropFilter: 'blur(4px)' }}
        >
          <Edit3 size={14} /> Update Field
        </button>
        <button
          onClick={() => setModal('delete')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.25)', color: 'white', fontWeight: 500, cursor: 'pointer' }}
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 6,
  border: '1px solid var(--border-color)',
  background: 'var(--bg-color)',
  color: 'var(--text-color)',
  outline: 'none',
  boxSizing: 'border-box',
}
