import * as fs from 'fs'
import * as path from 'path'
import * as iconv from 'iconv-lite'
import * as chardet from 'chardet'

export interface FindInFilesOptions {
  searchId?: string
  pattern: string
  isRegex: boolean
  isCaseSensitive: boolean
  isWholeWord: boolean
  directory: string
  fileFilter: string
  isRecursive: boolean
}

export interface FindResultLine {
  lineNumber: number
  column: number
  endColumn: number
  lineText: string
  matchText: string
}

export interface FindResultFile {
  filePath: string
  title: string
  results: FindResultLine[]
}

export const FIND_IN_FILES_MAX_PER_FILE = 500
/** Yield to the event loop every N directory visits while walking. */
const ASYNC_YIELD_EVERY_DIRS = 64
/** Concurrent file reads in streaming search. */
export const FIND_IN_FILES_V2_CONCURRENCY = 6

export function parseFilter(filter: string): RegExp {
  if (!filter || filter === '*' || filter === '*.*') return /.*/

  const patterns = filter.trim().split(/\s+/).map((f) => {
    const escaped = f
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    return `(${escaped})`
  })

  return new RegExp(patterns.join('|') + '$', 'i')
}

export async function* collectFilesAsync(
  dir: string,
  filterRe: RegExp,
  recursive: boolean
): AsyncGenerator<string> {
  let dirVisits = 0

  async function* walk(current: string): AsyncGenerator<string> {
    let entries: fs.Dirent[]
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true })
    } catch {
      return
    }

    dirVisits++
    if (dirVisits % ASYNC_YIELD_EVERY_DIRS === 0) {
      await new Promise<void>((resolve) => setImmediate(resolve))
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

      const full = path.join(current, entry.name)

      if (entry.isDirectory()) {
        if (recursive) yield* walk(full)
      } else if (entry.isFile()) {
        if (filterRe.test(entry.name)) {
          yield full
        }
      }
    }
  }

  yield* walk(dir)
}

function searchContent(content: string, re: RegExp): FindResultLine[] {
  if (content.slice(0, 8192).includes('\0')) return []

  const lines = content.split(/\r?\n/)
  const results: FindResultLine[] = []
  const maxPer = FIND_IN_FILES_MAX_PER_FILE

  for (let i = 0; i < lines.length && results.length < maxPer; i++) {
    const line = lines[i]
    re.lastIndex = 0

    let match: RegExpExecArray | null
    while ((match = re.exec(line)) !== null) {
      results.push({
        lineNumber: i + 1,
        column: match.index + 1,
        endColumn: match.index + match[0].length + 1,
        lineText: line.length > 500 ? line.slice(0, 500) + '…' : line,
        matchText: match[0]
      })

      if (match[0].length === 0) {
        re.lastIndex++
      }

      if (!re.global) break
    }
  }

  return results
}

export function searchBuffer(raw: Buffer, re: RegExp): FindResultLine[] {
  let content: string
  try {
    const encoding = chardet.detect(raw) || 'UTF-8'
    content = iconv.decode(raw, encoding)
  } catch {
    return []
  }

  return searchContent(content, re)
}

export function buildRegExp(opts: FindInFilesOptions): RegExp | null {
  try {
    let src = opts.pattern
    if (!opts.isRegex) {
      src = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
    if (opts.isWholeWord) {
      src = `\\b${src}\\b`
    }
    const flags = 'g' + (opts.isCaseSensitive ? '' : 'i')
    return new RegExp(src, flags)
  } catch {
    return null
  }
}
