import { app, shell, BrowserWindow, ipcMain, Menu } from 'electron'
import { join } from 'path'
import { buildMenu } from './menu'
import { registerFileHandlers } from './ipc/fileHandlers'
import { registerConfigHandlers } from './ipc/configHandlers'
import { registerPluginHandlers } from './ipc/pluginHandlers'
import { registerSearchHandlers } from './ipc/searchHandlers'
import { registerWatchHandlers } from './ipc/watchHandlers'
import { registerUpdateHandlers } from './ipc/updateHandlers'
import { UpdateManager } from './update/UpdateManager'
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
    autoHideMenuBar: process.platform !== 'darwin',
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

  // Register handlers that need mainWindow reference
  registerSearchHandlers(mainWindow!)
  registerWatchHandlers(mainWindow!)

  // Auto-update: check on startup (silent) + expose IPC for manual check/install
  const updateManager = new UpdateManager(mainWindow!)
  registerUpdateHandlers(updateManager)
  if (app.isPackaged && process.env['E2E_TEST'] !== '1') {
    setTimeout(() => {
      void updateManager.checkForUpdates(false)
    }, 5000)
  }

  // Load plugins BEFORE buildMenu so plugin menu items are included in the initial build.
  // Plugins register menu items via addPluginMenuItem which populates a registry; since
  // currentWin is still null at this point, no rebuild is triggered during loading.
  PluginLoader.getInstance().loadAll(mainWindow!)

  // Build native menu after plugins have registered their menu items
  buildMenu(mainWindow!, loadRecents())

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

// Expose the real app version (app.getVersion() reads from packaged metadata,
// unlike the env-var-based window.api.appVersion which is unreliable in prod).
ipcMain.handle('app:get-version', () => app.getVersion())

// Toggle DevTools from the custom in-app menu (native menu is hidden by autoHideMenuBar).
ipcMain.on('dev:toggle-devtools', () => {
  const win = BrowserWindow.getFocusedWindow() ?? mainWindow
  win?.webContents.toggleDevTools()
})

// Bidirectional state sync: renderer → main (update native menu checkboxes)
const toggleKeyToMenuId: Record<string, string> = {
  showToolbar: 'toggle-toolbar',
  showStatusBar: 'toggle-statusbar',
  showSidebar: 'toggle-sidebar',
  wordWrap: 'toggle-word-wrap',
  renderWhitespace: 'toggle-whitespace',
  indentationGuides: 'toggle-indent-guides',
  columnSelectMode: 'column-select',
  splitView: 'toggle-split-view'
}

ipcMain.on('ui:state-changed', (_event, payload: { key: string; value: boolean }) => {
  const menuId = toggleKeyToMenuId[payload.key]
  if (!menuId) return
  const menu = Menu.getApplicationMenu()
  if (!menu) return
  const item = menu.getMenuItemById(menuId)
  if (item) item.checked = payload.value
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
