import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as chardet from 'chardet'
import * as iconv from 'iconv-lite'
import { addRecent, loadRecents } from '../recentFiles'
import { updateRecentFiles } from '../menu'

export function registerFileHandlers(): void {
  // Read file with encoding detection
  ipcMain.handle('file:read', async (_event, filePath: string) => {
    try {
      const raw = await fs.promises.readFile(filePath)
      // Sample-based encoding detection: only scan first 64KB (sufficient for accuracy)
      const sample = raw.subarray(0, Math.min(raw.length, 65536))
      const encoding = chardet.detect(sample) || 'UTF-8'
      const content = iconv.decode(raw, encoding)
      const stats = await fs.promises.stat(filePath)
      const eol = content.includes('\r\n') ? 'CRLF' : content.includes('\r') ? 'CR' : 'LF'
      return { content, encoding, eol, mtime: stats.mtimeMs, error: null }
    } catch (err: any) {
      return { content: '', encoding: 'UTF-8', eol: 'LF', mtime: 0, error: err.message }
    }
  })

  // Write file
  ipcMain.handle('file:write', async (_event, filePath: string, content: string, encoding = 'UTF-8', eol = 'LF') => {
    try {
      let normalized = content
      // Normalize EOL
      normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      if (eol === 'CRLF') normalized = normalized.replace(/\n/g, '\r\n')
      else if (eol === 'CR') normalized = normalized.replace(/\n/g, '\r')

      const buf = iconv.encode(normalized, encoding)
      fs.writeFileSync(filePath, buf)
      return { error: null }
    } catch (err: any) {
      return { error: err.message }
    }
  })

  // Save dialog
  ipcMain.handle('file:save-dialog', async (_event, defaultPath?: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { canceled: true, filePath: null }
    const result = await dialog.showSaveDialog(win, {
      defaultPath,
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Text Files', extensions: ['txt'] }
      ]
    })
    return result
  })

  // Check if file was modified externally
  ipcMain.handle('file:check-mtime', async (_event, filePath: string, knownMtime: number) => {
    try {
      const stats = fs.statSync(filePath)
      return { changed: stats.mtimeMs > knownMtime, mtime: stats.mtimeMs }
    } catch {
      return { changed: false, mtime: knownMtime }
    }
  })

  // Batch stat check (used for session restore — check all files in one IPC call)
  ipcMain.handle('file:stat-batch', async (_event, filePaths: string[]) => {
    return filePaths.map((fp) => {
      try {
        const stats = fs.statSync(fp)
        return { filePath: fp, exists: true, mtime: stats.mtimeMs }
      } catch {
        return { filePath: fp, exists: false, mtime: 0 }
      }
    })
  })

  // Get file stats
  ipcMain.handle('file:stat', async (_event, filePath: string) => {
    try {
      const stats = fs.statSync(filePath)
      return { exists: true, size: stats.size, mtime: stats.mtimeMs, isDir: stats.isDirectory() }
    } catch {
      return { exists: false, size: 0, mtime: 0, isDir: false }
    }
  })

  // List directory
  ipcMain.handle('file:list-dir', async (_event, dirPath: string) => {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      return entries.map((e) => ({
        name: e.name,
        path: path.join(dirPath, e.name),
        isDir: e.isDirectory()
      }))
    } catch (err: any) {
      return []
    }
  })

  // Create file
  ipcMain.handle('file:create', async (_event, filePath: string) => {
    try {
      fs.writeFileSync(filePath, '')
      return { error: null }
    } catch (err: any) {
      return { error: err.message }
    }
  })

  // Delete file or directory
  ipcMain.handle('file:delete', async (_event, filePath: string) => {
    try {
      const stat = fs.statSync(filePath)
      if (stat.isDirectory()) {
        fs.rmSync(filePath, { recursive: true })
      } else {
        fs.unlinkSync(filePath)
      }
      return { error: null }
    } catch (err: any) {
      return { error: err.message }
    }
  })

  // Create directory
  ipcMain.handle('file:mkdir', async (_event, dirPath: string) => {
    try {
      fs.mkdirSync(dirPath, { recursive: true })
      return { error: null }
    } catch (err: any) {
      return { error: err.message }
    }
  })

  // Get recent files
  ipcMain.handle('file:get-recents', () => {
    return loadRecents()
  })

  // Rename/move file
  ipcMain.handle('file:rename', async (_event, oldPath: string, newPath: string) => {
    try {
      fs.renameSync(oldPath, newPath)
      return { error: null }
    } catch (err: any) {
      return { error: err.message }
    }
  })

  // Reveal in file explorer
  ipcMain.handle('file:reveal', async (_event, filePath: string) => {
    const { shell } = await import('electron')
    shell.showItemInFolder(filePath)
  })

  // Add to recent documents
  ipcMain.on('file:add-recent', (_event, filePath: string) => {
    app.addRecentDocument(filePath)
    const updated = addRecent(filePath)
    const win = BrowserWindow.getFocusedWindow()
    if (win) updateRecentFiles(win, updated)
  })

  ipcMain.handle('file:open-dialog', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Text Files', extensions: ['txt', 'md', 'log'] },
        { name: 'Source Code', extensions: ['js', 'ts', 'jsx', 'tsx', 'py', 'cpp', 'c', 'h', 'java', 'cs', 'go', 'rs'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths
  })

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
