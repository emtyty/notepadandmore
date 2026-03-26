import * as monaco from 'monaco-editor'

export interface UDLDefinition {
  name: string
  extensions: string[]          // e.g. ['myl', 'custom']
  caseSensitive: boolean
  keywordGroups: string[][]     // 8 groups, each is array of words
  operators: string             // operator chars e.g. '+-*/'
  lineComment: string           // e.g. '//'
  blockCommentOpen: string      // e.g. '/*'
  blockCommentClose: string     // e.g. '*/'
  delimiters: Array<{ open: string; close: string }>
  foldOpen: string
  foldClose: string
}

/**
 * Convert a UDL definition to a Monaco IMonarchLanguage.
 * Supports keyword groups, line/block comments, operators, string delimiters.
 */
export function udlToMonarch(udl: UDLDefinition): monaco.languages.IMonarchLanguage {
  // Build keyword sets
  const keywordSets: Record<string, string[]> = {}
  udl.keywordGroups.forEach((group, i) => {
    if (group.length > 0) {
      keywordSets[`keywords${i + 1}`] = group
    }
  })

  // Build tokenizer rules
  const root: monaco.languages.IMonarchLanguageRule[] = []

  // Line comment
  if (udl.lineComment) {
    root.push([new RegExp(escapeRegex(udl.lineComment) + '.*'), 'comment'])
  }

  // Block comment
  if (udl.blockCommentOpen && udl.blockCommentClose) {
    root.push([new RegExp(escapeRegex(udl.blockCommentOpen)), { token: 'comment', next: '@blockComment' }])
  }

  // String delimiters
  udl.delimiters.forEach((delim, i) => {
    if (delim.open && delim.close) {
      const stateName = `string${i}`
      root.push([new RegExp(escapeRegex(delim.open)), { token: 'string', next: `@${stateName}` }])
    }
  })

  // Numbers
  root.push([/\d+(\.\d+)?/, 'number'])

  // Operators
  if (udl.operators) {
    const opChars = udl.operators.split('').map(escapeRegex).join('')
    root.push([new RegExp(`[${opChars}]`), 'operator'])
  }

  // Identifiers + keywords
  root.push([
    /[a-zA-Z_]\w*/,
    {
      cases: {
        ...Object.fromEntries(
          Object.entries(keywordSets).map(([setName]) => [`@${setName}`, setName])
        ),
        '@default': 'identifier'
      }
    }
  ])

  // Build tokenizer states
  const states: Record<string, monaco.languages.IMonarchLanguageRule[]> = { root }

  // Block comment state
  if (udl.blockCommentOpen && udl.blockCommentClose) {
    states.blockComment = [
      [new RegExp(escapeRegex(udl.blockCommentClose)), { token: 'comment', next: '@pop' }],
      [/./, 'comment']
    ]
  }

  // String states
  udl.delimiters.forEach((delim, i) => {
    if (delim.open && delim.close) {
      const stateName = `string${i}`
      states[stateName] = [
        [new RegExp(escapeRegex(delim.close)), { token: 'string', next: '@pop' }],
        [/./, 'string']
      ]
    }
  })

  const lang: monaco.languages.IMonarchLanguage = {
    ignoreCase: !udl.caseSensitive,
    tokenizer: states
  }

  // Add keyword sets
  for (const [setName, words] of Object.entries(keywordSets)) {
    ;(lang as Record<string, unknown>)[setName] = words
  }

  return lang
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
