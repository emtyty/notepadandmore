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

export type SessionVirtualKind = 'settings' | 'shortcuts' | 'whatsNew'

interface SessionVirtualTab {
  kind: SessionVirtualKind
}

interface Session {
  version: number
  files: SessionFile[]
  virtualTabs: SessionVirtualTab[]
  activeIndex: number
  workspaceFolder?: string
}

const KNOWN_VIRTUAL_KINDS: ReadonlySet<SessionVirtualKind> = new Set(['settings', 'shortcuts', 'whatsNew'])

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

  /** Normalize any legacy version (v1, v2) to the current v3 format */
  private normalize(raw: unknown): Session | null {
    if (!raw || typeof raw !== 'object') return null
    const obj = raw as Record<string, unknown>
    const files = obj.files as unknown[]
    if (!Array.isArray(files)) return null

    const normalizedFiles: SessionFile[] = files
      .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object' && typeof (f as Record<string, unknown>).filePath === 'string')
      .map((f) => ({
        filePath: f.filePath as string,
        language: (f.language as string) || '',
        encoding: (f.encoding as string) || 'UTF-8',
        eol: (f.eol as string) || 'LF',
        viewState: (obj.version === 2 || obj.version === 3) ? ((f.viewState as object | null) ?? null) : null
      }))

    const activeIndex = typeof obj.activeIndex === 'number' ? obj.activeIndex : 0
    const workspaceFolder = typeof obj.workspaceFolder === 'string' ? obj.workspaceFolder : undefined

    // virtualTabs is v3+. Skip unknown kinds; tolerate malformed (non-array) values.
    const rawVirtual = obj.virtualTabs
    let virtualTabs: SessionVirtualTab[] = []
    if (obj.version === 3) {
      if (Array.isArray(rawVirtual)) {
        virtualTabs = rawVirtual
          .filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
          .map((v) => v.kind)
          .filter((k): k is SessionVirtualKind => typeof k === 'string' && KNOWN_VIRTUAL_KINDS.has(k as SessionVirtualKind))
          .map((kind) => ({ kind }))
        if (virtualTabs.length !== rawVirtual.length) {
          console.warn('[SessionManager] Skipped', rawVirtual.length - virtualTabs.length, 'invalid virtualTabs entries')
        }
      } else if (rawVirtual != null) {
        console.warn('[SessionManager] virtualTabs is not an array — ignoring')
      }
    }

    return {
      version: 3,
      files: normalizedFiles,
      virtualTabs,
      activeIndex,
      workspaceFolder
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
