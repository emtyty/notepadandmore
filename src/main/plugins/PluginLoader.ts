import { app, BrowserWindow, ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export interface PluginInfo {
  name: string
  version: string
  description?: string
  author?: string
  dirPath: string
  entryPath: string
  enabled: boolean
  error?: string
}

export class PluginLoader {
  private static instance: PluginLoader
  private plugins: Map<string, PluginInfo> = new Map()
  private win: BrowserWindow | null = null

  static getInstance(): PluginLoader {
    if (!PluginLoader.instance) PluginLoader.instance = new PluginLoader()
    return PluginLoader.instance
  }

  private get pluginsDir(): string {
    return path.join(app.getPath('userData'), 'plugins')
  }


  loadAll(win: BrowserWindow): void {
    this.win = win
    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir, { recursive: true })
      return
    }

    const entries = fs.readdirSync(this.pluginsDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      this.loadPlugin(path.join(this.pluginsDir, entry.name))
    }
  }

  private loadPlugin(dirPath: string): void {
    const pkgPath = path.join(dirPath, 'package.json')
    const entryPath = path.join(dirPath, 'index.js')

    if (!fs.existsSync(pkgPath) || !fs.existsSync(entryPath)) return

    let pkg: { name?: string; version?: string; description?: string; author?: string }
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    } catch {
      return
    }

    const info: PluginInfo = {
      name: pkg.name || path.basename(dirPath),
      version: pkg.version || '0.0.0',
      description: pkg.description,
      author: typeof pkg.author === 'string' ? pkg.author : undefined,
      dirPath,
      entryPath,
      enabled: true
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(entryPath)
      const plugin = mod.default || mod

      if (typeof plugin.activate !== 'function') {
        info.error = 'Missing activate() export'
        this.plugins.set(info.name, info)
        return
      }

      // Build the plugin API object
      const api = this.buildAPI(info.name)
      plugin.activate(api)

      this.plugins.set(info.name, info)
      console.log(`[PluginLoader] Loaded: ${info.name} v${info.version}`)
    } catch (err: any) {
      info.error = err.message
      info.enabled = false
      this.plugins.set(info.name, info)
      console.error(`[PluginLoader] Failed to load ${info.name}:`, err)
    }
  }

  private buildAPI(pluginName: string) {
    const win = this.win
    return {
      name: pluginName,
      editor: {
        getText: () => this.sendToRenderer('plugin:editor-get-text'),
        getSelectedText: () => this.sendToRenderer('plugin:editor-get-selection'),
        getCurrentFilePath: () => this.sendToRenderer('plugin:editor-get-path'),
        runCommand: (commandId: string) => win?.webContents.send('editor:command', commandId),
        insertText: (text: string) => win?.webContents.send('plugin:insert-text', pluginName, text),
        openFile: (filePath: string) => win?.webContents.send('menu:file-open', [filePath])
      },
      ui: {
        addMenuItem: (item: { label: string; callback: () => void }) => {
          win?.webContents.send('plugin:add-menu-item', pluginName, item.label)
          ipcMain.on(`plugin:menu-click:${pluginName}:${item.label}`, item.callback)
        },
        showMessage: (msg: string, level = 'info') => {
          win?.webContents.send('ui:show-toast', msg, level)
        }
      },
      events: {
        on: (event: string, handler: (...args: unknown[]) => void) => {
          ipcMain.on(`plugin:event:${event}`, (_e, ...args) => handler(...args))
        }
      },
      fs: {
        readFile: (filePath: string) => fs.promises.readFile(filePath, 'utf8'),
        writeFile: (filePath: string, content: string) => fs.promises.writeFile(filePath, content, 'utf8'),
        exists: (filePath: string) => Promise.resolve(fs.existsSync(filePath))
      }
    }
  }

  private sendToRenderer(channel: string): Promise<unknown> {
    return new Promise((resolve) => {
      if (!this.win) return resolve(null)
      this.win.webContents.send(channel)
      ipcMain.once(`${channel}:reply`, (_e, val) => resolve(val))
    })
  }

  reloadAll(): PluginInfo[] {
    this.plugins.clear()
    if (this.win) this.loadAll(this.win)
    return this.getPluginList()
  }

  getPluginList(): PluginInfo[] {
    return Array.from(this.plugins.values())
  }

  dispatchAPICall(pluginName: string, method: string, args: unknown[]): void {
    console.log(`[PluginLoader] API call from ${pluginName}: ${method}`, args)
  }
}
