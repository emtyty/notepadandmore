import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { buildMenu } from './menu'
import { registerFileHandlers } from './ipc/fileHandlers'
import { registerConfigHandlers } from './ipc/configHandlers'
import { registerPluginHandlers } from './ipc/pluginHandlers'
import { registerSearchHandlers } from './ipc/searchHandlers'
import { registerWatchHandlers } from './ipc/watchHandlers'
import { PluginLoader } from './plugins/PluginLoader'
import { SessionManager } from './sessions/SessionManager'
import { loadRecents } from './recentFiles'

let mainWindow: BrowserWindow | null = null

/** True when quit was initiated (Cmd+Q / Quit); false for macOS red close button only. */
let isQuitting = false

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    show: false,
    autoHideMenuBar: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.on('close', (e) => {
    if (process.env['E2E_TEST'] === '1') return // allow Playwright teardown
    // Let renderer handle unsaved changes check before close
    e.preventDefault()
    mainWindow?.webContents.send('app:before-close')
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.notepadandmore.app')
  }

  // Register IPC handlers (no window dependency)
  registerFileHandlers()
  registerConfigHandlers()
  registerPluginHandlers()

  createWindow()

  // Build native menu after window is created (with persisted recent files)
  buildMenu(mainWindow!, loadRecents())

  // Register handlers that need mainWindow reference
  registerSearchHandlers(mainWindow!)
  registerWatchHandlers(mainWindow!)

  // Load plugins
  PluginLoader.getInstance().loadAll(mainWindow!)

  // Restore last session (skip in E2E mode for clean test state)
  if (process.env['E2E_TEST'] !== '1') {
    SessionManager.getInstance().restore(mainWindow!)
  }

  app.on('activate', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
    } else if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || process.env['E2E_TEST'] === '1') app.quit()
})

ipcMain.on('app:close-cancelled', () => {
  isQuitting = false
})

ipcMain.on('session:save', (_event, session) => {
  SessionManager.getInstance().save(session)
})

ipcMain.on('app:close-confirmed', () => {
  // macOS: close window (red button) keeps app in Dock; Cmd+Q / Quit still exits.
  if (process.platform === 'darwin' && !isQuitting) {
    mainWindow?.hide()
    return
  }
  mainWindow?.destroy()
  app.quit()
})

export { mainWindow }
