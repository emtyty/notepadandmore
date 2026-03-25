import { ipcMain, BrowserWindow } from 'electron'
import chokidar, { FSWatcher } from 'chokidar'

const watchers = new Map<string, FSWatcher>()

export function registerWatchHandlers(win: BrowserWindow): void {
  ipcMain.handle('watch:add', (_event, filePath: string) => {
    if (watchers.has(filePath)) return
    const watcher = chokidar.watch(filePath, {
      persistent: false,
      ignoreInitial: true,
      usePolling: false,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }
    })
    watcher.on('change', () => {
      win.webContents.send('file:externally-changed', filePath)
    })
    watcher.on('unlink', () => {
      win.webContents.send('file:externally-deleted', filePath)
      watchers.delete(filePath)
    })
    watchers.set(filePath, watcher)
  })

  ipcMain.handle('watch:remove', (_event, filePath: string) => {
    const w = watchers.get(filePath)
    if (w) {
      w.close()
      watchers.delete(filePath)
    }
  })
}

export function closeAllWatchers(): void {
  for (const w of watchers.values()) w.close()
  watchers.clear()
}
