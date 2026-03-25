import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const RECENT_MAX = 15

function getRecentPath(): string {
  return path.join(app.getPath('userData'), 'config', 'recentFiles.json')
}

export function loadRecents(): string[] {
  try {
    const p = getRecentPath()
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {}
  return []
}

export function saveRecents(files: string[]): void {
  try {
    const p = getRecentPath()
    const dir = path.dirname(p)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(p, JSON.stringify(files), 'utf8')
  } catch {}
}

export function addRecent(filePath: string): string[] {
  const current = loadRecents()
  const updated = [filePath, ...current.filter((f) => f !== filePath)].slice(0, RECENT_MAX)
  saveRecents(updated)
  return updated
}
