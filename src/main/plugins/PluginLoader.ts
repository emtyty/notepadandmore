import { app, BrowserWindow, ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { addPluginMenuItem, removePluginMenuItem } from '../menu'

export interface PluginSettingField {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'select'
  default: unknown
  description?: string
  options?: Array<{ label: string; value: string | number }>
  min?: number
  max?: number
}

export interface PluginSettingsSchema {
  fields: PluginSettingField[]
}

export interface PluginInfo {
  name: string
  version: string
  description?: string
  author?: string
  homepage?: string
  license?: string
  dirPath: string
  entryPath: string
  enabled: boolean
  error?: string
  hasReadme: boolean
  hasChangelog: boolean
  hasIcon: boolean
  hasSettings: boolean
}

export interface PluginDetail {
  name: string
  version: string
  description?: string
  author?: string
  homepage?: string
  license?: string
  readme: string | null
  changelog: string | null
  iconDataUrl: string | null
}

export class PluginLoader {
  private static instance: PluginLoader
  private plugins: Map<string, PluginInfo> = new Map()
  private pluginModules: Map<string, { activate?: Function; deactivate?: Function }> = new Map()
  private pluginSettingsSchemas: Map<string, PluginSettingsSchema> = new Map()
  private menuCallbacks: Map<string, () => void> = new Map()
  private win: BrowserWindow | null = null

  static getInstance(): PluginLoader {
    if (!PluginLoader.instance) {
      PluginLoader.instance = new PluginLoader()
      // Single global listener for renderer-triggered plugin menu clicks
      ipcMain.on('plugin:invoke-menu-click', (_e, pluginName: string, label: string) => {
        const cb = PluginLoader.instance.menuCallbacks.get(`${pluginName}::${label}`)
        if (cb) {
          try { cb() } catch (err) {
            console.error(`[PluginLoader] callback error for ${pluginName}:${label}:`, err)
          }
        }
      })
    }
    return PluginLoader.instance
  }

  get pluginsDir(): string {
    return path.join(app.getPath('userData'), 'plugins')
  }

  private get pluginConfigDir(): string {
    return path.join(app.getPath('userData'), 'config', 'plugin-settings')
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

    let pkg: Record<string, unknown>
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    } catch {
      return
    }

    const info: PluginInfo = {
      name: (pkg.name as string) || path.basename(dirPath),
      version: (pkg.version as string) || '0.0.0',
      description: pkg.description as string | undefined,
      author: typeof pkg.author === 'string' ? pkg.author : undefined,
      homepage: pkg.homepage as string | undefined,
      license: pkg.license as string | undefined,
      dirPath,
      entryPath,
      enabled: true,
      hasReadme: fs.existsSync(path.join(dirPath, 'README.md')),
      hasChangelog: fs.existsSync(path.join(dirPath, 'CHANGELOG.md')),
      hasIcon: fs.existsSync(path.join(dirPath, 'icon.png')),
      hasSettings: false
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

      // Store module reference for deactivate/reload
      this.pluginModules.set(info.name, plugin)

      // Build the plugin API object
      const api = this.buildAPI(info.name)
      plugin.activate(api)

      // Check if plugin contributed settings
      info.hasSettings = this.pluginSettingsSchemas.has(info.name)

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
        addMenuItem: (item: { label: string; accelerator?: string; callback: () => void }) => {
          if (win) addPluginMenuItem(win, pluginName, [item])
          win?.webContents.send('plugin:add-menu-item', pluginName, item.label, item.accelerator)
          // Register the callback in a lookup so the renderer-side custom menu can invoke it
          this.menuCallbacks.set(`${pluginName}::${item.label}`, item.callback)
        },
        showMessage: (msg: string, level = 'info') => {
          win?.webContents.send('ui:show-toast', msg, level)
        },
        openCsvViewer: (csvText: string, options?: { fileName?: string }) => {
          win?.webContents.send('plugin:open-csv-viewer', {
            csvText,
            fileName: options?.fileName ?? ''
          })
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
      },
      settings: {
        contributeSettings: (schema: PluginSettingsSchema) => {
          this.pluginSettingsSchemas.set(pluginName, schema)
        },
        get: (key: string): unknown => {
          return this.getPluginConfigValue(pluginName, key)
        },
        set: (key: string, value: unknown): void => {
          this.setPluginConfigValue(pluginName, key, value)
        }
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

  // ── Granular lifecycle ──

  enablePlugin(pluginName: string): PluginInfo {
    const info = this.plugins.get(pluginName)
    if (!info) throw new Error(`Plugin "${pluginName}" not found`)
    if (info.enabled && !info.error) return info

    // Reload from disk
    this.loadPlugin(info.dirPath)
    const updated = this.plugins.get(pluginName)!
    this.notifyRenderer(updated)
    return updated
  }

  disablePlugin(pluginName: string): PluginInfo {
    const info = this.plugins.get(pluginName)
    if (!info) throw new Error(`Plugin "${pluginName}" not found`)
    if (!info.enabled) return info

    // Call deactivate if available
    const mod = this.pluginModules.get(pluginName)
    if (mod && typeof mod.deactivate === 'function') {
      try { mod.deactivate() } catch (err) {
        console.warn(`[PluginLoader] deactivate() failed for ${pluginName}:`, err)
      }
    }

    // Clear require cache so a future enable gets fresh code
    try { delete require.cache[require.resolve(info.entryPath)] } catch { /* ignore */ }

    this.pluginModules.delete(pluginName)
    this.pluginSettingsSchemas.delete(pluginName)
    if (this.win) removePluginMenuItem(this.win, pluginName)
    info.enabled = false
    info.error = undefined
    info.hasSettings = false
    this.plugins.set(pluginName, info)

    this.notifyRenderer(info)
    return info
  }

  reloadPlugin(pluginName: string): PluginInfo {
    this.disablePlugin(pluginName)
    return this.enablePlugin(pluginName)
  }

  installPlugin(sourcePath: string): PluginInfo {
    const pkgPath = path.join(sourcePath, 'package.json')
    if (!fs.existsSync(pkgPath)) {
      throw new Error('Selected folder does not contain a package.json')
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    const pluginName = pkg.name || path.basename(sourcePath)
    const targetPath = path.join(this.pluginsDir, pluginName)

    // Ensure plugins dir exists
    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir, { recursive: true })
    }

    // Copy plugin folder
    fs.cpSync(sourcePath, targetPath, { recursive: true })

    // Load the plugin
    this.loadPlugin(targetPath)

    const info = this.plugins.get(pluginName)
    if (!info) throw new Error(`Failed to load plugin "${pluginName}" after install`)

    this.notifyRenderer(info)
    return info
  }

  uninstallPlugin(pluginName: string): void {
    const info = this.plugins.get(pluginName)
    if (!info) throw new Error(`Plugin "${pluginName}" not found`)

    // Disable first (deactivate + cache clear)
    if (info.enabled) {
      try { this.disablePlugin(pluginName) } catch { /* may already be disabled */ }
    }

    // Remove from disk
    fs.rmSync(info.dirPath, { recursive: true, force: true })

    // Remove from maps
    this.plugins.delete(pluginName)
    this.pluginModules.delete(pluginName)
    this.pluginSettingsSchemas.delete(pluginName)

    this.notifyRenderer({ ...info, enabled: false })
  }

  // ── Detail / metadata ──

  getPluginDetail(pluginName: string): PluginDetail | null {
    const info = this.plugins.get(pluginName)
    if (!info) return null

    let readme: string | null = null
    const readmePath = path.join(info.dirPath, 'README.md')
    if (fs.existsSync(readmePath)) {
      try { readme = fs.readFileSync(readmePath, 'utf8') } catch { /* ignore */ }
    }

    let changelog: string | null = null
    const changelogPath = path.join(info.dirPath, 'CHANGELOG.md')
    if (fs.existsSync(changelogPath)) {
      try { changelog = fs.readFileSync(changelogPath, 'utf8') } catch { /* ignore */ }
    }

    let iconDataUrl: string | null = null
    const iconPath = path.join(info.dirPath, 'icon.png')
    if (fs.existsSync(iconPath)) {
      try {
        const buf = fs.readFileSync(iconPath)
        iconDataUrl = `data:image/png;base64,${buf.toString('base64')}`
      } catch { /* ignore */ }
    }

    return {
      name: info.name,
      version: info.version,
      description: info.description,
      author: info.author,
      homepage: info.homepage,
      license: info.license,
      readme,
      changelog,
      iconDataUrl
    }
  }

  // ── Settings ──

  getSettingsSchemas(): Record<string, PluginSettingsSchema> {
    return Object.fromEntries(this.pluginSettingsSchemas)
  }

  getPluginConfigValue(pluginName: string, key: string): unknown {
    const configPath = path.join(this.pluginConfigDir, `${pluginName}.json`)
    if (!fs.existsSync(configPath)) return undefined
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
      return config[key]
    } catch {
      return undefined
    }
  }

  setPluginConfigValue(pluginName: string, key: string, value: unknown): void {
    if (!fs.existsSync(this.pluginConfigDir)) {
      fs.mkdirSync(this.pluginConfigDir, { recursive: true })
    }
    const configPath = path.join(this.pluginConfigDir, `${pluginName}.json`)
    let config: Record<string, unknown> = {}
    if (fs.existsSync(configPath)) {
      try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')) } catch { /* fresh */ }
    }
    config[key] = value
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
  }

  // ── Existing bulk methods ──

  reloadAll(): PluginInfo[] {
    this.plugins.clear()
    this.pluginModules.clear()
    this.pluginSettingsSchemas.clear()
    if (this.win) this.loadAll(this.win)
    return this.getPluginList()
  }

  getPluginList(): PluginInfo[] {
    return Array.from(this.plugins.values())
  }

  dispatchAPICall(pluginName: string, method: string, args: unknown[]): void {
    console.log(`[PluginLoader] API call from ${pluginName}: ${method}`, args)
  }

  private notifyRenderer(info: PluginInfo): void {
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send('plugin:state-changed', info)
    }
  }
}
