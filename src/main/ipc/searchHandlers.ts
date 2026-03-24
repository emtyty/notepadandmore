import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

interface SearchOptions {
  searchText: string
  directory: string
  fileFilter: string
  matchCase: boolean
  wholeWord: boolean
  isRegex: boolean
}

interface SearchResult {
  filePath: string
  lineNumber: number
  lineText: string
  matchStart: number
  matchEnd: number
}

const MAX_DEPTH = 20
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_RESULTS = 5000

function isBinaryBuffer(buf: Buffer): boolean {
  // Check first 8KB for null bytes
  const len = Math.min(buf.length, 8192)
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return true
  }
  return false
}

function matchesGlob(filename: string, filter: string): boolean {
  if (!filter || filter === '*.*' || filter === '*') return true
  const patterns = filter.split(',').map((p) => p.trim())
  return patterns.some((pattern) => {
    const ext = pattern.replace(/^\*\.?/, '').toLowerCase()
    if (!ext) return true
    return filename.toLowerCase().endsWith(`.${ext}`)
  })
}

function searchFile(
  filePath: string,
  regex: RegExp,
  results: SearchResult[]
): void {
  try {
    const stat = fs.statSync(filePath)
    if (stat.size > MAX_FILE_SIZE) return

    const buf = fs.readFileSync(filePath)
    if (isBinaryBuffer(buf)) return

    const content = buf.toString('utf-8')
    const lines = content.split('\n')

    for (let i = 0; i < lines.length && results.length < MAX_RESULTS; i++) {
      const line = lines[i]
      let match: RegExpExecArray | null
      // Reset regex for each line
      regex.lastIndex = 0
      while ((match = regex.exec(line)) !== null) {
        results.push({
          filePath,
          lineNumber: i + 1,
          lineText: line.trimEnd(),
          matchStart: match.index,
          matchEnd: match.index + match[0].length
        })
        if (!regex.global) break
      }
    }
  } catch {
    // Skip files we can't read
  }
}

function walkDir(
  dir: string,
  fileFilter: string,
  regex: RegExp,
  results: SearchResult[],
  depth: number
): void {
  if (depth > MAX_DEPTH || results.length >= MAX_RESULTS) return

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (results.length >= MAX_RESULTS) break

      // Skip hidden dirs and common non-code dirs
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'out') {
        if (entry.isDirectory()) continue
      }

      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        walkDir(fullPath, fileFilter, regex, results, depth + 1)
      } else if (entry.isFile() && matchesGlob(entry.name, fileFilter)) {
        searchFile(fullPath, regex, results)
      }
    }
  } catch {
    // Skip dirs we can't read
  }
}

export function registerSearchHandlers(): void {
  ipcMain.handle('search:find-in-files', async (_event, opts: SearchOptions) => {
    const { searchText, directory, fileFilter, matchCase, wholeWord, isRegex } = opts

    if (!searchText || !directory) return []

    let pattern = isRegex ? searchText : searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (wholeWord) pattern = `\\b${pattern}\\b`

    const flags = `g${matchCase ? '' : 'i'}`
    let regex: RegExp
    try {
      regex = new RegExp(pattern, flags)
    } catch {
      return []
    }

    const results: SearchResult[] = []
    walkDir(directory, fileFilter, regex, results, 0)
    return results
  })

  ipcMain.handle('dialog:open-folder', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })
}
