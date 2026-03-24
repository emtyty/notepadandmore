import { app, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

interface SessionFile {
  filePath: string
  cursorLine: number
  cursorColumn: number
  scrollTop: number
  language: string
}

interface Session {
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
      fs.writeFileSync(sp, JSON.stringify(session, null, 2), 'utf8')
    } catch (err) {
      console.error('[SessionManager] Failed to save session:', err)
    }
  }

  load(): Session | null {
    try {
      const sp = this.getSessionPath()
      if (!fs.existsSync(sp)) return null
      return JSON.parse(fs.readFileSync(sp, 'utf8'))
    } catch {
      return null
    }
  }

  restore(win: BrowserWindow): void {
    const session = this.load()
    if (session) {
      // Send to renderer after it's ready
      win.webContents.once('did-finish-load', () => {
        setTimeout(() => {
          win.webContents.send('session:restore', session)
        }, 500)
      })
    }
  }
}
