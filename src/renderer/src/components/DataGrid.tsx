import React, { useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
} from '@tanstack/react-table'

interface DataGridProps {
  data: any[]
}

export const DataGrid: React.FC<DataGridProps> = ({ data }) => {
  const columns = useMemo<ColumnDef<any>[]>(() => {
    if (!data || data.length === 0) return []
    
    // Get unique keys across all items
    const keys = new Set<string>()
    data.forEach(item => Object.keys(item).forEach(k => keys.add(k)))
    
    // Sort so 'id' is first
    const sortedKeys = Array.from(keys).sort((a, b) => {
      if (a === 'id') return -1
      if (b === 'id') return 1
      return a.localeCompare(b)
    })

    return sortedKeys.map(key => ({
      header: key,
      accessorKey: key,
      cell: (info) => {
        const val = info.getValue()
        if (val === null || val === undefined) return <span style={{ opacity: 0.5 }}>null</span>
        if (typeof val === 'object') return JSON.stringify(val)
        if (typeof val === 'boolean') return val ? 'true' : 'false'
        return String(val)
      }
    }))
  }, [data])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (!data || data.length === 0) {
    return <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-color-mute)' }}>No data to display. Execute a query to view results.</div>
  }

  return (
    <div className="table-container" style={{ overflow: 'auto', flex: 1 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
        <thead style={{ position: 'sticky', top: 0, background: 'var(--glass-bg)', zIndex: 10 }}>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th key={header.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-color-soft)', fontWeight: 600 }}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
              {row.getVisibleCells().map(cell => (
                <td key={cell.id} style={{ padding: '12px 16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
