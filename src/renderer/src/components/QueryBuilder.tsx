import React, { useState, useEffect } from 'react'
import { Plus, X, Play } from 'lucide-react'

interface QueryBuilderProps {
  collectionName: string
  onExecute: (filters: any[], limit: number) => void
}

const getOperatorsForType = (type: string) => {
  if (type === 'string' || type === 'number') return ['==', '!=', '>', '<', '>=', '<=']
  if (type === 'array') return ['array-contains', 'array-contains-any']
  if (type === 'boolean' || type === 'null') return ['==', '!=']
  return ['==', '!=', '>', '<', '>=', '<='] // default fallback
}

export const QueryBuilder: React.FC<QueryBuilderProps> = ({ collectionName, onExecute }) => {
  const [schema, setSchema] = useState<Array<{ name: string; type: string }>>([])
  const [filters, setFilters] = useState<Array<{ field: string, operator: string, value: any }>>([])
  const [limit, setLimit] = useState(50)
  
  useEffect(() => {
    setFilters([])
    if (collectionName) {
      window.api.sampleCollectionSchema(collectionName).then(setSchema).catch(console.error)
    }
  }, [collectionName])

  const handleAddFilter = () => {
    const defaultField = schema.length > 0 ? schema[0].name : ''
    const defaultOp = '=='
    setFilters([...filters, { field: defaultField, operator: defaultOp, value: '' }])
  }

  const updateFilter = (index: number, key: string, val: string) => {
    const newFilters = [...filters]
    newFilters[index][key] = val
    if (key === 'field') {
       const type = schema.find(s => s.name === val)?.type || 'string'
       newFilters[index].operator = getOperatorsForType(type)[0]
    }
    setFilters(newFilters)
  }

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index))
  }

  const handleExecute = () => {
     // attempt to cast values intelligently
     const castedFilters = filters.map(f => {
         const type = schema.find(s => s.name === f.field)?.type
         let finalValue: any = f.value
         if (type === 'number') finalValue = Number(f.value)
         if (type === 'boolean') finalValue = f.value === 'true'
         if (type === 'null') finalValue = null
         return { ...f, value: finalValue }
     })
     onExecute(castedFilters, limit)
  }


  return (
    <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      


      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontWeight: 600 }}>Query Constructor <span style={{ opacity: 0.5 }}>({collectionName})</span></h3>
        <div style={{ display: 'flex', gap: '12px' }}>
           <input 
             type="number" 
             value={limit} 
             onChange={e => setLimit(Number(e.target.value))}
             style={{ width: '80px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }}
             title="Query Limit"
           />
           <button onClick={handleExecute} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--accent-color)', color: '#fff', padding: '6px 16px', borderRadius: '6px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
             <Play size={14} /> Execute
           </button>
        </div>
      </div>

      {filters.length === 0 ? (
         <div style={{ padding: '10px 0', color: 'var(--text-color-mute)', fontStyle: 'italic', fontSize: '13px' }}>No active filters. Result will fetch top {limit} documents.</div>
      ) : (
         <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
           {filters.map((f, index) => {
             const type = schema.find(s => s.name === f.field)?.type || 'string'
             const ops = getOperatorsForType(type)
             return (
               <div key={index} style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'var(--bg-color-soft)', padding: '10px', borderRadius: '8px' }}>
                  <select value={f.field} onChange={(e) => updateFilter(index, 'field', e.target.value)} style={selectStyle}>
                     {schema.length === 0 ? <option value="">Loading schema...</option> : schema.map(s => <option key={s.name} value={s.name}>{s.name} ({s.type})</option>)}
                  </select>
                  <select value={f.operator} onChange={(e) => updateFilter(index, 'operator', e.target.value)} style={selectStyle}>
                     {ops.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <input type="text" value={f.value} onChange={(e) => updateFilter(index, 'value', e.target.value)} placeholder="Value..." style={inputStyle} />
                  <button onClick={() => removeFilter(index)} style={{ color: 'var(--text-color-mute)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <X size={16} />
                  </button>
               </div>
             )
           })}
         </div>
      )}

      <div>
        <button onClick={handleAddFilter} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-color)', fontSize: '14px', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>
           <Plus size={16} /> Add filter row
        </button>
      </div>
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', outline: 'none'
}
const inputStyle: React.CSSProperties = {
  ...selectStyle, flex: 1
}
