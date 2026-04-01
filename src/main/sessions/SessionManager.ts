import { app, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

interface SessionFile {
  filePath: string
  language: string
  encoding: string
  eol: string
  viewState: object | null
}

interface Session {
  version: number
  files: SessionFile[]
  activeIndex: number
  workspaceFolder?: string
}

export class SessionManager {
  private static instance: SessionManager
  private sessionPath: string

  constructor() {
    this.sessionPath = ''
  }

  private getSessionPath(): string {
    if (!this.sessionPath) {
      this.sessionPath = path.join(app.getPath('userData'), 'config', 'session.json')
    }
    return this.sessionPath
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) SessionManager.instance = new SessionManager()
    return SessionManager.instance
  }

  save(session: Session): void {
    try {
      const sp = this.getSessionPath()
      const dir = path.dirname(sp)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      // Backup existing session before overwriting
      if (fs.existsSync(sp)) {
        try { fs.copyFileSync(sp, sp + '.bak') } catch { /* ignore backup failure */ }
      }
      fs.writeFileSync(sp, JSON.stringify(session, null, 2), 'utf8')
    } catch (err) {
      console.error('[SessionManager] Failed to save session:', err)
    }
  }

  load(): Session | null {
    const sp = this.getSessionPath()
    // Try main file first, then backup
    for (const file of [sp, sp + '.bak']) {
      try {
        if (!fs.existsSync(file)) continue
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
        const session = this.normalize(raw)
        if (session) return session
      } catch { /* try next */ }
    }
    return null
  }

  /** Convert v1 (or any legacy) format to v2 */
  private normalize(raw: unknown): Session | null {
    if (!raw || typeof raw !== 'object') return null
    const obj = raw as Record<string, unknown>
    const files = obj.files as unknown[]
    if (!Array.isArray(files)) return null

    // v2 format — pass through
    if (obj.version === 2) return obj as unknown as Session

    // v1 format — migrate
    return {
      version: 2,
      files: files
        .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object' && typeof (f as Record<string, unknown>).filePath === 'string')
        .map((f) => ({
          filePath: f.filePath as string,
          language: (f.language as string) || '',
          encoding: (f.encoding as string) || 'UTF-8',
          eol: (f.eol as string) || 'LF',
          viewState: null
        })),
      activeIndex: typeof obj.activeIndex === 'number' ? obj.activeIndex : 0,
      workspaceFolder: typeof obj.workspaceFolder === 'string' ? obj.workspaceFolder : undefined
    }
  }

  restore(win: BrowserWindow): void {
    const session = this.load()
    if (session) {
      win.webContents.once('did-finish-load', () => {
        win.webContents.send('session:restore', session)
      })
    }
  }
}
