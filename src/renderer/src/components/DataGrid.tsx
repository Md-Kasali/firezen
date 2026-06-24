import React, { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table'
import { Pencil, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

interface DataGridProps {
  data: any[]
  onSelectionChange: (selectedIds: string[]) => void
  onEditRow?: (doc: any) => void
}

export const DataGrid: React.FC<DataGridProps> = ({ data, onSelectionChange, onEditRow }) => {
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
  const [sorting, setSorting] = useState<SortingState>([])

  const columns = useMemo<ColumnDef<any>[]>(() => {
    if (!data || data.length === 0) return []

    // ── Checkbox column ──────────────────────────────────────────────
    const checkboxCol: ColumnDef<any> = {
      id: '__select__',
      enableSorting: false,
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
          style={{ cursor: 'pointer', accentColor: 'var(--accent-color)' }}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          style={{ cursor: 'pointer', accentColor: 'var(--accent-color)' }}
        />
      ),
      size: 40,
    }

    // ── Actions column ───────────────────────────────────────────────
    const actionsCol: ColumnDef<any> = {
      id: '__actions__',
      enableSorting: false,
      header: () => null,
      cell: ({ row }) => (
        <button
          title="Edit document"
          onClick={e => { e.stopPropagation(); onEditRow?.(row.original) }}
          style={{ background: 'none', border: 'none', color: 'var(--text-color-mute)', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', opacity: 0.6, transition: 'opacity 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
        >
          <Pencil size={13} />
        </button>
      ),
      size: 36,
    }

    // ── Data columns ─────────────────────────────────────────────────
    const keys = new Set<string>()
    data.forEach(item => Object.keys(item).forEach(k => keys.add(k)))
    const sortedKeys = Array.from(keys).sort((a, b) => {
      if (a === 'id') return -1
      if (b === 'id') return 1
      return a.localeCompare(b)
    })

    const dataCols: ColumnDef<any>[] = sortedKeys.map(key => ({
      header: key,
      accessorKey: key,
      enableSorting: true,
      sortingFn: (rowA, rowB, columnId) => {
        const a = rowA.getValue(columnId)
        const b = rowB.getValue(columnId)
        if (a === null || a === undefined) return 1
        if (b === null || b === undefined) return -1
        if (typeof a === 'number' && typeof b === 'number') return a - b
        return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
      },
      cell: (info) => {
        const val = info.getValue()
        if (val === null || val === undefined) return <span style={{ opacity: 0.4, fontStyle: 'italic' }}>null</span>
        if (typeof val === 'object') return <span style={{ opacity: 0.7 }}>{JSON.stringify(val)}</span>
        if (typeof val === 'boolean') return <span style={{ color: val ? 'var(--accent-color)' : 'var(--text-color-mute)' }}>{String(val)}</span>
        return String(val)
      }
    }))

    return [checkboxCol, actionsCol, ...dataCols]
  }, [data, onEditRow])

  const table = useReactTable({
    data,
    columns,
    state: { rowSelection, sorting },
    onRowSelectionChange: (updater) => {
      const next = typeof updater === 'function' ? updater(rowSelection) : updater
      setRowSelection(next)
      const selectedIds = Object.keys(next)
        .filter(k => next[k])
        .map(idx => data[Number(idx)]?.id)
        .filter(Boolean)
      onSelectionChange(selectedIds)
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row, idx) => String(idx),
    enableRowSelection: true,
    enableMultiSort: false,
  })

  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-color-mute)' }}>
        No data to display. Execute a query to view results.
      </div>
    )
  }

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
        <thead style={{ position: 'sticky', top: 0, background: 'var(--glass-bg)', zIndex: 10, backdropFilter: 'blur(8px)' }}>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => {
                const canSort = header.column.getCanSort()
                const sorted = header.column.getIsSorted()
                return (
                  <th
                    key={header.id}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--border-color)',
                      color: sorted ? 'var(--accent-color)' : 'var(--text-color-soft)',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      width: (header.column.id === '__select__' || header.column.id === '__actions__') ? `${header.column.columnDef.size}px` : 'auto',
                      cursor: canSort ? 'pointer' : 'default',
                      userSelect: 'none',
                      transition: 'color 0.15s',
                    }}
                  >
                    {header.isPlaceholder ? null : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, opacity: sorted ? 1 : 0.3, color: sorted ? 'var(--accent-color)' : 'var(--text-color-mute)', transition: 'opacity 0.15s' }}>
                            {sorted === 'asc'  ? <ChevronUp size={14} /> :
                             sorted === 'desc' ? <ChevronDown size={14} /> :
                             <ChevronsUpDown size={13} />}
                          </span>
                        )}
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, i) => (
            <tr
              key={row.id}
              style={{
                borderBottom: '1px solid var(--border-color)',
                background: row.getIsSelected() ? 'var(--accent-color-dim, rgba(99,102,241,0.08))' : i % 2 === 1 ? 'var(--bg-color-soft)' : 'transparent',
                transition: 'background 0.15s ease',
              }}
            >
              {row.getVisibleCells().map(cell => (
                <td key={cell.id} style={{ padding: '8px 14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '280px' }}>
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
