import React, { useState, useEffect } from 'react'
import { X, Plus, Trash2, Save } from 'lucide-react'

interface SchemaField {
  name: string
  type: string
}

interface DocumentEditorProps {
  mode: 'create' | 'edit'
  doc?: Record<string, any>       // existing doc data in edit mode
  schema: SchemaField[]
  collectionName: string
  onSave: () => void
  onClose: () => void
}

// Cast string input → proper JS type based on field type
function castValue(raw: string, type: string): any {
  if (raw === '' || raw === 'null') return null
  if (type === 'number') return isNaN(Number(raw)) ? raw : Number(raw)
  if (type === 'boolean') return raw === 'true'
  if (type === 'array' || type === 'object') {
    try { return JSON.parse(raw) } catch { return raw }
  }
  return raw
}

// Render the raw value as an editable string for the textarea/input
function displayValue(val: any): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object') return JSON.stringify(val, null, 2)
  return String(val)
}

function FieldRow({ name, type, value, onChange, onRemove }: {
  name: string; type: string; value: any
  onChange: (v: any) => void; onRemove: () => void
}) {
  const raw = displayValue(value)

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '7px 10px',
    borderRadius: 5,
    border: '1px solid var(--border-color)',
    background: 'var(--bg-color)',
    color: 'var(--text-color)',
    fontFamily: type === 'array' || type === 'object' ? 'monospace' : 'inherit',
    fontSize: 13,
    outline: 'none',
    resize: 'vertical',
  }

  const renderInput = () => {
    if (type === 'boolean') {
      return (
        <select
          value={String(value ?? 'false')}
          onChange={e => onChange(e.target.value === 'true')}
          style={{ ...inputStyle, fontFamily: 'inherit', cursor: 'pointer' }}
        >
          <option value="true">true</option>
          <option value="false">false</option>
          <option value="null">null</option>
        </select>
      )
    }
    if (type === 'array' || type === 'object') {
      return (
        <textarea
          rows={3}
          defaultValue={raw}
          onBlur={e => onChange(castValue(e.target.value, type))}
          style={inputStyle}
          placeholder="JSON value..."
        />
      )
    }
    return (
      <input
        type={type === 'number' ? 'number' : 'text'}
        defaultValue={raw}
        onBlur={e => onChange(castValue(e.target.value, type))}
        style={inputStyle}
        placeholder={`${type} value...`}
      />
    )
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
      <div style={{ width: 140, flexShrink: 0, paddingTop: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-color)' }}>{name}</span>
        <div style={{ fontSize: 11, color: 'var(--text-color-mute)', marginTop: 2 }}>{type}</div>
      </div>
      {renderInput()}
      <button
        onClick={onRemove}
        title="Remove field"
        style={{ padding: 6, background: 'none', border: 'none', color: 'var(--text-color-mute)', cursor: 'pointer', flexShrink: 0, marginTop: 4 }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  mode, doc, schema, collectionName, onSave, onClose
}) => {
  // Build initial field state
  const buildInitialFields = () => {
    if (mode === 'edit' && doc) {
      const { id, ...rest } = doc
      return Object.entries(rest).map(([name, value]) => ({ name, value }))
    }
    // create mode — seed from schema
    return schema
      .filter(f => f.name !== 'id')
      .map(f => ({ name: f.name, value: f.type === 'boolean' ? false : f.type === 'number' ? 0 : '' }))
  }

  const [docId, setDocId] = useState(mode === 'edit' ? doc?.id ?? '' : '')
  const [fields, setFields] = useState<Array<{ name: string; value: any }>>(buildInitialFields)
  const [newFieldName, setNewFieldName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  // Tracks field names that existed in the original doc and were explicitly removed
  const [deletedFields, setDeletedFields] = useState<Set<string>>(new Set())

  const updateValue = (idx: number, val: any) => {
    setFields(f => f.map((field, i) => i === idx ? { ...field, value: val } : field))
  }

  const removeField = (idx: number) => {
    const fieldName = fields[idx].name
    // If we're in edit mode and this field existed in the original doc, mark it for Firestore deletion
    if (mode === 'edit' && doc && Object.prototype.hasOwnProperty.call(doc, fieldName)) {
      setDeletedFields(prev => new Set([...prev, fieldName]))
    }
    setFields(f => f.filter((_, i) => i !== idx))
  }

  const addField = () => {
    const name = newFieldName.trim()
    if (!name || fields.find(f => f.name === name)) return
    setFields(f => [...f, { name, value: '' }])
    setNewFieldName('')
  }

  const getFieldType = (name: string) => schema.find(f => f.name === name)?.type || 'string'

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const payload: Record<string, any> = {}
      for (const { name, value } of fields) {
        payload[name] = value
      }

      if (mode === 'create') {
        const res = await window.api.createDocument(collectionName, payload, docId || undefined)
        if (!res.success) { alert('Create failed: ' + res.error); return }
      } else {
        const res = await window.api.updateDocument(collectionName, doc!.id, payload, Array.from(deletedFields))
        if (!res.success) { alert('Update failed: ' + res.error); return }
      }

      onSave()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div className="glass-panel" style={{ width: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>
              {mode === 'create' ? 'New Document' : `Edit Document`}
            </h3>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-color-mute)' }}>{collectionName}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-color-mute)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Document ID */}
        <div style={{ padding: '16px 24px 0', flexShrink: 0 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-color-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Document ID {mode === 'create' && <span style={{ fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>(leave blank to auto-generate)</span>}
          </label>
          <input
            type="text"
            value={docId}
            onChange={e => setDocId(e.target.value)}
            disabled={mode === 'edit'}
            placeholder="Auto-generated"
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: mode === 'edit' ? 'var(--bg-color-soft)' : 'var(--bg-color)', color: 'var(--text-color)', fontFamily: 'monospace', fontSize: 13, outline: 'none', boxSizing: 'border-box', opacity: mode === 'edit' ? 0.7 : 1 }}
          />
        </div>

        {/* Fields */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 16px' }}>
          <div style={{ marginBottom: 8, marginTop: 16, fontSize: 12, fontWeight: 600, color: 'var(--text-color-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fields</div>
          {fields.map((field, idx) => (
            <FieldRow
              key={`${field.name}-${idx}`}
              name={field.name}
              type={getFieldType(field.name)}
              value={field.value}
              onChange={val => updateValue(idx, val)}
              onRemove={() => removeField(idx)}
            />
          ))}

          {/* Add new field row */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="New field name..."
              value={newFieldName}
              onChange={e => setNewFieldName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addField()}
              style={{ flex: 1, padding: '7px 10px', borderRadius: 5, border: '1px dashed var(--border-color)', background: 'transparent', color: 'var(--text-color)', fontSize: 13, outline: 'none' }}
            />
            <button
              onClick={addField}
              disabled={!newFieldName.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 14px', borderRadius: 5, border: '1px solid var(--border-color)', background: 'none', color: 'var(--accent-color)', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: newFieldName.trim() ? 1 : 0.4 }}
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'none', color: 'var(--text-color)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 6, border: 'none', background: 'var(--accent-color)', color: 'var(--accent-fg)', fontWeight: 600, cursor: 'pointer', opacity: isSaving ? 0.6 : 1 }}
          >
            <Save size={14} />
            {isSaving ? 'Saving…' : mode === 'create' ? 'Create Document' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
