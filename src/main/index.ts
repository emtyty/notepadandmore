import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { buildMenu } from './menu'
import { registerFileHandlers } from './ipc/fileHandlers'
import { registerConfigHandlers } from './ipc/configHandlers'
import { registerPluginHandlers } from './ipc/pluginHandlers'
import { PluginLoader } from './plugins/PluginLoader'
import { SessionManager } from './sessions/SessionManager'

let mainWindow: BrowserWindow | null = null

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

  // Register IPC handlers
  registerFileHandlers()
  registerConfigHandlers()
  registerPluginHandlers()

  createWindow()

  // Build native menu after window is created
  buildMenu(mainWindow!)

  // Load plugins
  PluginLoader.getInstance().loadAll(mainWindow!)

  // Restore last session
  SessionManager.getInstance().restore(mainWindow!)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Allow renderer to confirm close is safe
import { ipcMain } from 'electron'
ipcMain.on('app:close-confirmed', () => {
  mainWindow?.destroy()
})

export { mainWindow }
