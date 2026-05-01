import { ipcMain } from 'electron'
import { BackupManager } from '../sessions/BackupManager'

export function registerBackupHandlers(): void {
  const mgr = BackupManager.getInstance()

  ipcMain.handle('backup:write', (_e, filename: string, content: string) => {
    try {
      mgr.write(filename, content)
      return { error: null }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { error: msg }
    }
  })

  ipcMain.handle('backup:read', (_e, filename: string) => mgr.read(filename))

  ipcMain.handle('backup:delete', (_e, filename: string) => {
    mgr.delete(filename)
  })

  ipcMain.handle('backup:get-dir', () => mgr.getDir())

  ipcMain.handle('backup:list', () => mgr.list())

  ipcMain.handle('backup:cleanup', (_e, keep: string[]) => {
    mgr.cleanupExcept(new Set(keep ?? []))
  })
}
