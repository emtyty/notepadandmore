import { app, shell, BrowserWindow, ipcMain, Menu } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { buildMenu } from './menu'
import { registerFileHandlers } from './ipc/fileHandlers'
import { registerConfigHandlers } from './ipc/configHandlers'
import { registerPluginHandlers } from './ipc/pluginHandlers'
import { registerSearchHandlers } from './ipc/searchHandlers'
import { registerWatchHandlers } from './ipc/watchHandlers'
import { registerUpdateHandlers } from './ipc/updateHandlers'
import { registerBackupHandlers } from './ipc/backupHandlers'
import { UpdateManager } from './update/UpdateManager'
import { PluginLoader } from './plugins/PluginLoader'
import { SessionManager } from './sessions/SessionManager'
import { loadRecents } from './recentFiles'

let mainWindow: BrowserWindow | null = null

/** True when quit was initiated (Cmd+Q / Quit); false for macOS red close button only. */
let isQuitting = false

/**
 * Files queued to open as soon as the renderer is ready. Populated by:
 *  - process.argv on cold launch (Windows + Linux "Open with" routes args here)
 *  - app 'open-file' event before window exists (macOS Finder "Open With")
 * Drained once on did-finish-load.
 */
const pendingOpenFiles: string[] = []

/** Filter argv (or the args from a second-instance event) down to real file paths. */
function filePathsFromArgv(argv: string[]): string[] {
  // argv[0] is the exe; on packaged builds, the rest is whatever the OS passed.
  // Be conservative: only forward args that point at an actual file on disk so
  // we don't mistake CLI flags or chromium switches for file paths.
  const out: string[] = []
  for (const arg of argv.slice(1)) {
    if (!arg || arg.startsWith('-')) continue
    try {
      const s = fs.statSync(arg)
      if (s.isFile()) out.push(arg)
    } catch {
      // arg isn't a path — skip silently.
    }
  }
  return out
}

/** Send queued files to the renderer (or queue them if it isn't ready yet). */
function dispatchOpenFiles(files: string[]): void {
  if (files.length === 0) return
  if (mainWindow && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send('menu:file-open', files)
  } else {
    pendingOpenFiles.push(...files)
  }
}

// Single-instance lock: when the user launches NovaPad a second time (e.g.
// double-clicks another .json after the app is already running), Windows
// spawns a new exe process. We want to forward those args to the existing
// instance instead of launching a separate window.
//
// Skip in E2E mode — Playwright launches one Electron instance per test
// sequentially, and OS lock release timing can race the next launch.
if (process.env['E2E_TEST'] !== '1') {
  const gotInstanceLock = app.requestSingleInstanceLock()
  if (!gotInstanceLock) {
    app.quit()
  } else {
    app.on('second-instance', (_event, argv) => {
      const files = filePathsFromArgv(argv)
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        if (!mainWindow.isVisible()) mainWindow.show()
        mainWindow.focus()
      }
      dispatchOpenFiles(files)
    })
  }
}

// macOS routes "Open With → NovaPad" through this event instead of argv.
// It can fire BEFORE app.whenReady, so we just queue and let did-finish-load
// drain pendingOpenFiles when the renderer is ready.
app.on('open-file', (event, filePath) => {
  event.preventDefault()
  if (filePath) dispatchOpenFiles([filePath])
})

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

  // Drain queued open-file requests once the renderer is ready to receive
  // 'menu:file-open'. Ordering note: did-finish-load fires AFTER session
  // restore IPC, so files opened via Open With end up alongside (not in
  // place of) the user's previous session.
  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingOpenFiles.length === 0) return
    const files = pendingOpenFiles.splice(0, pendingOpenFiles.length)
    mainWindow!.webContents.send('menu:file-open', files)
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

  // Cold-launch arg handling: when Windows/Linux "Open with NovaPad" fires
  // for the *first* instance, the file path lands in process.argv. Queue it
  // now so did-finish-load forwards it to the renderer.
  if (process.env['E2E_TEST'] !== '1') {
    const initialFiles = filePathsFromArgv(process.argv)
    if (initialFiles.length) pendingOpenFiles.push(...initialFiles)
  }

  // Register IPC handlers (no window dependency)
  registerFileHandlers()
  registerConfigHandlers()
  registerPluginHandlers()
  registerBackupHandlers()

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
