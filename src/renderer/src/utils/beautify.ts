export type BeautifyFormat = 'json' | 'xml' | 'sql'

const SQL_LANGS = new Set(['sql', 'mysql', 'pgsql', 'plsql', 'tsql'])
const XML_LANGS = new Set(['xml', 'html', 'xhtml', 'svg'])

export function detectBeautifyFormat(
  text: string,
  language?: string | null
): BeautifyFormat | null {
  if (language === 'json') return 'json'
  if (language && XML_LANGS.has(language)) return 'xml'
  if (language && SQL_LANGS.has(language)) return 'sql'

  const trimmed = text.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json'
  if (trimmed.startsWith('<')) return 'xml'
  if (
    /^\s*(WITH|SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE|ALTER|DROP|MERGE|TRUNCATE)\b/i.test(
      trimmed
    )
  ) {
    return 'sql'
  }
  return null
}

export function beautify(
  text: string,
  format: BeautifyFormat,
  indent: string | number
): string {
  switch (format) {
    case 'json':
      return beautifyJson(text, indent)
    case 'xml':
      return beautifyXml(text, typeof indent === 'number' ? ' '.repeat(indent) : indent)
    case 'sql':
      return beautifySql(text, typeof indent === 'number' ? ' '.repeat(indent) : indent)
  }
}

function beautifyJson(text: string, indent: string | number): string {
  return JSON.stringify(JSON.parse(text), null, indent)
}

function beautifyXml(text: string, indent: string): string {
  const tokens: string[] = []
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]+>|[^<]+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const t = m[0]
    if (t.startsWith('<')) tokens.push(t)
    else if (t.trim()) tokens.push(t.trim())
  }

  if (!tokens.some((t) => t.startsWith('<'))) {
    throw new Error('No XML tags detected')
  }

  const out: string[] = []
  let depth = 0

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    const isTag = t.startsWith('<')
    const isClose = isTag && t.startsWith('</')
    const isMeta = isTag && (t.startsWith('<?') || t.startsWith('<!'))
    const isSelfClose = isTag && !isClose && !isMeta && /\/\s*>$/.test(t)
    const isOpen = isTag && !isClose && !isMeta && !isSelfClose

    if (
      isOpen &&
      i + 2 < tokens.length &&
      !tokens[i + 1].startsWith('<') &&
      tokens[i + 2].startsWith('</')
    ) {
      out.push(indent.repeat(depth) + t + tokens[i + 1] + tokens[i + 2])
      i += 2
      continue
    }

    if (isClose) depth = Math.max(0, depth - 1)
    out.push(indent.repeat(depth) + t)
    if (isOpen) depth++
  }

  return out.join('\n')
}

const SQL_BLOCK_KEYWORDS = [
  'WITH',
  'SELECT',
  'FROM',
  'WHERE',
  'GROUP BY',
  'HAVING',
  'ORDER BY',
  'LIMIT',
  'OFFSET',
  'UNION ALL',
  'UNION',
  'INTERSECT',
  'EXCEPT',
  'INSERT INTO',
  'VALUES',
  'UPDATE',
  'SET',
  'DELETE FROM',
  'CREATE TABLE',
  'ALTER TABLE',
  'DROP TABLE',
  'INNER JOIN',
  'LEFT OUTER JOIN',
  'RIGHT OUTER JOIN',
  'FULL OUTER JOIN',
  'LEFT JOIN',
  'RIGHT JOIN',
  'CROSS JOIN',
  'JOIN',
  'ON',
  'AND',
  'OR'
].sort((a, b) => b.length - a.length)

function beautifySql(text: string, indent: string): string {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Empty SQL')

  const placeholders: string[] = []
  const stringOrCommentRe =
    /'(?:[^'\\]|\\.|'')*'|"(?:[^"\\]|\\.)*"|--[^\n]*|\/\*[\s\S]*?\*\//g
  let working = trimmed.replace(stringOrCommentRe, (s) => {
    placeholders.push(s)
    return `PH${placeholders.length - 1}`
  })

  working = working.replace(/\s+/g, ' ').trim()

  for (const kw of SQL_BLOCK_KEYWORDS) {
    const re = new RegExp(`\\b${kw.replace(/ /g, '\\s+')}\\b`, 'gi')
    working = working.replace(re, `\n${kw.toUpperCase()}`)
  }

  working = working.replace(/\s*\(\s*/g, ' (').replace(/\s*\)\s*/g, ') ')

  const rawLines = working
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const out: string[] = []
  let depth = 0
  for (const line of rawLines) {
    const startsWithClose = line.startsWith(')')
    const lineDepth = startsWithClose ? Math.max(0, depth - 1) : depth
    out.push(indent.repeat(lineDepth) + line)
    const opens = (line.match(/\(/g) || []).length
    const closes = (line.match(/\)/g) || []).length
    depth = Math.max(0, depth + opens - closes)
  }

  return out
    .join('\n')
    .replace(/PH(\d+)/g, (_, idx) => placeholders[Number(idx)])
}
