import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as iconv from 'iconv-lite'
import * as chardet from 'chardet'

interface FindInFilesOptions {
  pattern: string
  isRegex: boolean
  isCaseSensitive: boolean
  isWholeWord: boolean
  directory: string
  fileFilter: string    // "*.ts *.js" or "*.*"
  isRecursive: boolean
}

interface FindResultLine {
  lineNumber: number
  column: number
  endColumn: number
  lineText: string
  matchText: string
}

interface FindResultFile {
  filePath: string
  title: string
  results: FindResultLine[]
}

/** Parse glob-style filter "*.ts *.js" → list of extensions or patterns */
function parseFilter(filter: string): RegExp {
  if (!filter || filter === '*' || filter === '*.*') return /.*/

  const patterns = filter.trim().split(/\s+/).map((f) => {
    // Convert glob to regex: *.ts → \.ts$, *.* → .*, foo.txt → foo\.txt
    const escaped = f
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    return `(${escaped})`
  })

  return new RegExp(patterns.join('|') + '$', 'i')
}

/** Collect all files matching filter, optionally recursive */
function collectFiles(dir: string, filterRe: RegExp, recursive: boolean): string[] {
  const results: string[] = []

  function walk(current: string): void {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      // Skip hidden dirs like .git, node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

      const full = path.join(current, entry.name)

      if (entry.isDirectory()) {
        if (recursive) walk(full)
      } else if (entry.isFile()) {
        if (filterRe.test(entry.name)) {
          results.push(full)
        }
      }
    }
  }

  walk(dir)
  return results
}

/** Search within a single file */
function searchFile(
  filePath: string,
  re: RegExp
): FindResultLine[] {
  let content: string
  try {
    const raw = fs.readFileSync(filePath)
    const encoding = chardet.detect(raw) || 'UTF-8'
    content = iconv.decode(raw, encoding)
  } catch {
    return []
  }

  // Skip binary files (heuristic: null bytes in first 8KB)
  if (content.slice(0, 8192).includes('\0')) return []

  const lines = content.split(/\r?\n/)
  const results: FindResultLine[] = []

  // Limit results per file to avoid OOM
  const MAX_PER_FILE = 500

  for (let i = 0; i < lines.length && results.length < MAX_PER_FILE; i++) {
    const line = lines[i]
    re.lastIndex = 0  // reset for global regex

    let match: RegExpExecArray | null
    while ((match = re.exec(line)) !== null) {
      results.push({
        lineNumber: i + 1,
        column: match.index + 1,
        endColumn: match.index + match[0].length + 1,
        lineText: line.length > 500 ? line.slice(0, 500) + '…' : line,
        matchText: match[0]
      })

      // Avoid infinite loop on zero-width matches
      if (match[0].length === 0) {
        re.lastIndex++
      }

      if (!re.global) break
    }
  }

  return results
}

/** Build the RegExp from search options */
function buildRegExp(opts: FindInFilesOptions): RegExp | null {
  try {
    let src = opts.pattern
    if (!opts.isRegex) {
      // Escape special regex chars for literal search
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

export function registerSearchHandlers(): void {
  // Find in Files
  ipcMain.handle('search:find-in-files', async (_event, opts: FindInFilesOptions) => {
    if (!opts.pattern || !opts.directory) {
      return { totalHits: 0, files: [] }
    }

    const re = buildRegExp(opts)
    if (!re) return { totalHits: 0, files: [], error: 'Invalid pattern' }

    const filterRe = parseFilter(opts.fileFilter)
    const filePaths = collectFiles(opts.directory, filterRe, opts.isRecursive)

    const files: FindResultFile[] = []
    let totalHits = 0

    // Limit total files searched
    const MAX_FILES = 2000
    const limited = filePaths.slice(0, MAX_FILES)

    for (const fp of limited) {
      // Reset regex state for each file
      re.lastIndex = 0
      const results = searchFile(fp, re)
      if (results.length > 0) {
        files.push({
          filePath: fp,
          title: path.basename(fp),
          results
        })
        totalHits += results.length
      }
    }

    return { totalHits, files }
  })

  // Open directory dialog (for Find in Files "Browse" button)
  ipcMain.handle('file:open-dir-dialog', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
}
