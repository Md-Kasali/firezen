import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Terminal } from 'lucide-react'

interface SchemaField {
  name: string
  type: string
  sampleValues?: any[]
}

interface FqlEditorProps {
  schema: SchemaField[]
  onExecute: (fqlString: string) => void
  isLoading: boolean
}

// Operators valid per field type
const TYPE_OPERATORS: Record<string, string[]> = {
  string:    ['==', '!=', '>', '>=', '<', '<=', 'IN', 'NOT_IN'],
  number:    ['==', '!=', '>', '>=', '<', '<='],
  boolean:   ['==', '!='],
  array:     ['HAS', 'HAS_ANY'],
  timestamp: ['==', '!=', '>', '>=', '<', '<='],
  null:      ['==', '!='],
  geopoint:  [],
  reference: ['==', '!='],
}

const ALL_OPERATORS = ['==', '!=', '>', '>=', '<', '<=', 'HAS', 'HAS_ANY', 'IN', 'NOT_IN']
const KEYWORDS = ['AND', 'ORDER BY', 'LIMIT']

// ─── Tokenizer ────────────────────────────────────────────────────────────────
function tokenizeUpTo(text: string): { completed: string[]; partial: string } {
  const tokens: string[] = []
  let current = ''
  let inQuote = false
  let quoteChar = ''

  for (const ch of text) {
    if (inQuote) {
      current += ch
      if (ch === quoteChar) inQuote = false
    } else if (ch === '"' || ch === "'") {
      inQuote = true; quoteChar = ch; current += ch
    } else if (ch === ' ') {
      if (current) { tokens.push(current); current = '' }
    } else {
      current += ch
    }
  }

  const endsWithSpace = text === '' || text.endsWith(' ')
  if (endsWithSpace) {
    if (current) tokens.push(current)
    return { completed: tokens, partial: '' }
  }
  return { completed: tokens, partial: current }
}

// ─── Context Detection ────────────────────────────────────────────────────────
type CtxType = 'field' | 'operator' | 'value' | 'keyword' | 'orderField' | 'orderDir'

function detectContext(completed: string[], partial: string, schema: SchemaField[]) {
  const upper = completed.map(t => t.toUpperCase())

  // After ORDER BY?
  for (let i = upper.length - 1; i >= 0; i--) {
    if (upper[i] === 'ORDER' && upper[i + 1] === 'BY') {
      const afterBy = completed.slice(i + 2)
      if (afterBy.length === 0) return { ctx: 'orderField' as CtxType, partial }
      if (afterBy.length === 1) return { ctx: 'orderDir' as CtxType, partial }
      break
    }
  }

  // Find last AND
  let lastAndIdx = -1
  for (let i = upper.length - 1; i >= 0; i--) {
    if (upper[i] === 'AND') { lastAndIdx = i; break }
  }

  const clauseTokens = completed.slice(lastAndIdx + 1)
  if (clauseTokens.length === 0) return { ctx: 'field' as CtxType, partial }
  if (clauseTokens.length === 1) return { ctx: 'operator' as CtxType, field: clauseTokens[0], partial }
  if (clauseTokens.length === 2) return { ctx: 'value' as CtxType, field: clauseTokens[0], partial }
  return { ctx: 'keyword' as CtxType, partial }
}

// ─── Suggestion Generation ────────────────────────────────────────────────────
function filterByPrefix(items: string[], prefix: string): string[] {
  if (!prefix) return items
  const low = prefix.toLowerCase().replace(/["']/g, '')
  return items.filter(item => item.toLowerCase().replace(/["']/g, '').startsWith(low))
}

function computeSuggestions(query: string, cursorPos: number, schema: SchemaField[]): string[] {
  if (!schema.length) return []
  const textBefore = query.slice(0, cursorPos)
  const { completed, partial } = tokenizeUpTo(textBefore)
  const detected = detectContext(completed, partial, schema)

  switch (detected.ctx) {
    case 'field':
    case 'orderField':
      return filterByPrefix(schema.map(f => f.name), detected.partial)

    case 'operator': {
      const ft = schema.find(f => f.name === (detected as any).field)?.type || 'string'
      const ops = TYPE_OPERATORS[ft] || ALL_OPERATORS
      return filterByPrefix(ops, detected.partial)
    }

    case 'value': {
      const fi = schema.find(f => f.name === (detected as any).field)
      const samples: any[] = (fi as any)?.sampleValues || []
      const quoted = samples.map(v => fi?.type === 'string' ? `"${v}"` : String(v))
      return filterByPrefix(quoted, detected.partial)
    }

    case 'orderDir':
      return filterByPrefix(['ASC', 'DESC'], detected.partial)

    case 'keyword':
      return filterByPrefix(KEYWORDS, detected.partial)
  }
  return []
}

// ─── Suggestion Insertion ─────────────────────────────────────────────────────
function insertSuggestion(
  suggestion: string,
  query: string,
  cursorPos: number,
  partial: string
): { newQuery: string; newCursor: number } {
  const before = query.slice(0, cursorPos - partial.length)
  const after = query.slice(cursorPos)
  const inserted = suggestion + ' '
  return {
    newQuery: before + inserted + after.trimStart(),
    newCursor: before.length + inserted.length,
  }
}

// ─── Validator (lightweight client-side) ─────────────────────────────────────
function validateFql(query: string): string | null {
  if (!query.trim()) return null
  let inQ = false; let qC = ''
  for (const ch of query) {
    if (inQ) { if (ch === qC) inQ = false }
    else if (ch === '"' || ch === "'") { inQ = true; qC = ch }
  }
  if (inQ) return 'Unclosed string literal'
  return null
}

// ─── Component ────────────────────────────────────────────────────────────────
export const FqlEditor: React.FC<FqlEditorProps> = ({ schema, onExecute, isLoading }) => {
  const [query, setQuery] = useState('')
  const [cursorPos, setCursorPos] = useState(0)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [selIdx, setSelIdx] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const suggestionRefs = useRef<(HTMLLIElement | null)[]>([])

  // Recompute suggestions on every keystroke / cursor move
  useEffect(() => {
    const s = computeSuggestions(query, cursorPos, schema)
    setSuggestions(s)
    setSelIdx(0)
    setShowSuggestions(s.length > 0)
    setError(validateFql(query))
  }, [query, cursorPos, schema])

  // Scroll selected item into view
  useEffect(() => {
    suggestionRefs.current[selIdx]?.scrollIntoView({ block: 'nearest' })
  }, [selIdx])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuery(e.target.value)
    setCursorPos(e.target.selectionStart ?? e.target.value.length)
  }

  const handleCursorMove = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    setCursorPos((e.target as HTMLTextAreaElement).selectionStart ?? 0)
  }

  const applySuggestion = useCallback((suggestion: string) => {
    const ta = textareaRef.current
    const cp = ta?.selectionStart ?? cursorPos
    const { partial } = tokenizeUpTo(query.slice(0, cp))
    const { newQuery, newCursor } = insertSuggestion(suggestion, query, cp, partial)
    setQuery(newQuery)
    setShowSuggestions(false)
    requestAnimationFrame(() => {
      if (ta) {
        ta.focus()
        ta.setSelectionRange(newCursor, newCursor)
        setCursorPos(newCursor)
      }
    })
  }, [query, cursorPos])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Suggestion navigation
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelIdx(i => Math.min(i + 1, suggestions.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelIdx(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault(); applySuggestion(suggestions[selIdx]); return
      }
      if (e.key === 'Escape') { setShowSuggestions(false); return }
    }
    // Run query
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault(); handleRun()
    }
  }

  const handleRun = () => {
    if (!query.trim() || isLoading) return
    onExecute(query.trim())
    setShowSuggestions(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Terminal size={15} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>FQL Editor</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--text-color-mute)', opacity: 0.7 }}>
          Ctrl+Enter to run &nbsp;·&nbsp; Tab/↑↓ to navigate suggestions
        </span>
        <button
          onClick={handleRun}
          disabled={isLoading || !query.trim()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 6, border: 'none', background: 'var(--accent-color)', color: 'white', fontWeight: 600, cursor: 'pointer', opacity: (isLoading || !query.trim()) ? 0.45 : 1, transition: 'opacity 0.15s' }}
        >
          <Play size={13} /> {isLoading ? 'Running…' : 'Run'}
        </button>
      </div>

      {/* Editor area */}
      <div style={{ position: 'relative' }}>
        <textarea
          ref={textareaRef}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={handleCursorMove}
          onClick={handleCursorMove}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
          spellCheck={false}
          rows={4}
          placeholder={`status == "active" AND score > 4 ORDER BY score DESC LIMIT 50\n\nType a field name to start — suggestions appear automatically`}
          style={{
            width: '100%',
            fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", "Courier New", monospace',
            fontSize: 13,
            lineHeight: 1.65,
            padding: '12px 14px',
            paddingBottom: showSuggestions && suggestions.length > 0 ? '48px' : '12px',
            borderRadius: 8,
            border: error ? '1.5px solid #ef4444' : '1px solid var(--border-color)',
            background: 'var(--bg-color)',
            color: 'var(--text-color)',
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s, padding-bottom 0.1s',
          }}
        />

        {/* Inline Suggestion Strip — anchored inside the textarea bottom edge */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 10px',
              overflowX: 'auto',
              overflowY: 'hidden',
              background: 'var(--glass-bg, rgba(20, 20, 35, 0.92))',
              backdropFilter: 'blur(12px)',
              borderTop: '1px solid var(--border-color)',
              borderBottomLeftRadius: 8,
              borderBottomRightRadius: 8,
              scrollbarWidth: 'none',
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-color-mute)', opacity: 0.5, flexShrink: 0, marginRight: 4 }}>
              Tab ↵
            </span>
            {suggestions.slice(0, 8).map((s, i) => (
              <button
                key={s}
                ref={el => { suggestionRefs.current[i] = el as any }}
                onMouseDown={e => { e.preventDefault(); applySuggestion(s) }}
                onMouseEnter={() => setSelIdx(i)}
                style={{
                  padding: '3px 10px',
                  borderRadius: 4,
                  border: i === selIdx ? 'none' : '1px solid var(--border-color)',
                  background: i === selIdx ? 'var(--accent-color)' : 'rgba(255,255,255,0.04)',
                  color: i === selIdx ? 'white' : 'var(--text-color)',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  fontWeight: i === selIdx ? 600 : 400,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'background 0.1s, color 0.1s',
                }}
              >
                {s}
              </button>
            ))}
            {suggestions.length > 8 && (
              <span style={{ fontSize: 11, color: 'var(--text-color-mute)', opacity: 0.5, flexShrink: 0 }}>
                +{suggestions.length - 8}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Status line */}
      <div style={{ marginTop: 6, minHeight: 18 }}>
        {error ? (
          <span style={{ fontSize: 12, color: '#ef4444' }}>⚠ {error}</span>
        ) : query.trim() && !isLoading ? (
          <span style={{ fontSize: 12, color: 'var(--text-color-mute)', opacity: 0.6 }}>
            Query ready &nbsp;·&nbsp; start typing to see suggestions
          </span>
        ) : null}
      </div>
    </div>
  )
}
