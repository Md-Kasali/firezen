export interface FqlFilter {
  field: string
  operator: string
  value: any
}

export interface FqlOrderBy {
  field: string
  direction: 'asc' | 'desc'
}

export interface ParsedFql {
  filters: FqlFilter[]
  orderBy: FqlOrderBy | null
  limit: number
  error?: string
}

const OPERATOR_MAP: Record<string, string> = {
  '==':     '==',
  '!=':     '!=',
  '>':      '>',
  '>=':     '>=',
  '<':      '<',
  '<=':     '<=',
  'HAS':    'array-contains',
  'HAS_ANY':'array-contains-any',
  'IN':     'in',
  'NOT_IN': 'not-in',
}

function parseValue(val: string): any {
  const t = val.trim()
  if (t === 'null') return null
  if (t === 'true') return true
  if (t === 'false') return false
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1)
  }
  if (t.startsWith('[') && t.endsWith(']')) {
    try { return JSON.parse(t) } catch { return t }
  }
  const n = Number(t)
  if (!isNaN(n) && t !== '') return n
  return t
}

function tokenizeFql(input: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inQuote = false
  let quoteChar = ''
  let brackets = 0

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (inQuote) {
      current += ch
      if (ch === quoteChar) inQuote = false
    } else if (ch === '"' || ch === "'") {
      inQuote = true; quoteChar = ch; current += ch
    } else if (ch === '[') {
      brackets++; current += ch
    } else if (ch === ']') {
      brackets--; current += ch
    } else if (ch === ' ' && brackets === 0) {
      if (current.trim()) { tokens.push(current.trim()); current = '' }
    } else {
      current += ch
    }
  }
  if (current.trim()) tokens.push(current.trim())
  return tokens
}

export function parseFql(query: string): ParsedFql {
  try {
    let tokens = tokenizeFql(query.trim())
    if (tokens.length === 0) return { filters: [], orderBy: null, limit: 50 }

    let limit = 50
    let orderBy: FqlOrderBy | null = null

    // Extract LIMIT n
    const limitIdx = tokens.findIndex(t => t.toUpperCase() === 'LIMIT')
    if (limitIdx !== -1) {
      const lv = Number(tokens[limitIdx + 1])
      if (!isNaN(lv) && lv > 0) limit = lv
      tokens.splice(limitIdx, 2)
    }

    // Extract ORDER BY field [ASC|DESC]
    const orderIdx = tokens.findIndex(t => t.toUpperCase() === 'ORDER')
    if (orderIdx !== -1 && tokens[orderIdx + 1]?.toUpperCase() === 'BY') {
      const field = tokens[orderIdx + 2]
      if (!field) throw new Error('ORDER BY requires a field name')
      const dirToken = tokens[orderIdx + 3]?.toUpperCase()
      const direction: 'asc' | 'desc' = dirToken === 'DESC' ? 'desc' : 'asc'
      const spliceCount = (dirToken === 'ASC' || dirToken === 'DESC') ? 4 : 3
      orderBy = { field, direction }
      tokens.splice(orderIdx, spliceCount)
    }

    // Parse WHERE conditions separated by AND
    const filters: FqlFilter[] = []
    let i = 0
    while (i < tokens.length) {
      if (tokens[i].toUpperCase() === 'AND') { i++; continue }

      const field = tokens[i]
      const rawOp = tokens[i + 1]
      const valueToken = tokens[i + 2]

      if (!field || !rawOp || valueToken === undefined) { i++; continue }

      const operator = OPERATOR_MAP[rawOp.toUpperCase()]
      if (!operator) throw new Error(`Unknown operator "${rawOp}". Valid: ${Object.keys(OPERATOR_MAP).join(', ')}`)

      filters.push({ field, operator, value: parseValue(valueToken) })
      i += 3
    }

    return { filters, orderBy, limit }
  } catch (err: any) {
    return { filters: [], orderBy: null, limit: 50, error: err.message }
  }
}
