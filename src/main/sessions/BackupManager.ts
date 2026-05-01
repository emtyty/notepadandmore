import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export class BackupManager {
  private static instance: BackupManager
  private backupDir = ''

  static getInstance(): BackupManager {
    if (!BackupManager.instance) BackupManager.instance = new BackupManager()
    return BackupManager.instance
  }

  getDir(): string {
    if (!this.backupDir) {
      this.backupDir = path.join(app.getPath('userData'), 'backup')
    }
    return this.backupDir
  }

  private ensureDir(): void {
    const dir = this.getDir()
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }

  private resolve(filename: string): string {
    if (
      !filename ||
      filename.includes('/') ||
      filename.includes('\\') ||
      filename.includes('..')
    ) {
      throw new Error(`Invalid backup filename: ${filename}`)
    }
    return path.join(this.getDir(), filename)
  }

  write(filename: string, content: string): void {
    this.ensureDir()
    const target = this.resolve(filename)
    const tmp = target + '.tmp'
    fs.writeFileSync(tmp, content, 'utf8')
    fs.renameSync(tmp, target)
  }

  read(filename: string): string | null {
    try {
      return fs.readFileSync(this.resolve(filename), 'utf8')
    } catch {
      return null
    }
  }

  delete(filename: string): void {
    try {
      const target = this.resolve(filename)
      if (fs.existsSync(target)) fs.unlinkSync(target)
    } catch {
      // ignore — best-effort cleanup
    }
  }

  list(): string[] {
    try {
      this.ensureDir()
      return fs.readdirSync(this.getDir()).filter((f) => !f.endsWith('.tmp'))
    } catch {
      return []
    }
  }

  /** Delete every backup whose filename is NOT in the keep set. */
  cleanupExcept(keep: Set<string>): void {
    for (const f of this.list()) {
      if (!keep.has(f)) this.delete(f)
    }
  }
}
