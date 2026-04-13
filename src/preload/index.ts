import { contextBridge, ipcRenderer } from 'electron'

// Expose safe IPC API to renderer via window.api
const api = {
  // Platform info
  platform: process.platform,
  appVersion: process.env['npm_package_version'] ?? '1.0.0',

  // File operations
  file: {
    read: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
    write: (filePath: string, content: string, encoding?: string, eol?: string) =>
      ipcRenderer.invoke('file:write', filePath, content, encoding, eol),
    saveDialog: (defaultPath?: string) => ipcRenderer.invoke('file:save-dialog', defaultPath),
    openDialog: () => ipcRenderer.invoke('file:open-dialog'),
    openDirDialog: () => ipcRenderer.invoke('file:open-dir-dialog'),
    checkMtime: (filePath: string, mtime: number) => ipcRenderer.invoke('file:check-mtime', filePath, mtime),
    stat: (filePath: string) => ipcRenderer.invoke('file:stat', filePath),
    statBatch: (filePaths: string[]) => ipcRenderer.invoke('file:stat-batch', filePaths),
    listDir: (dirPath: string) => ipcRenderer.invoke('file:list-dir', dirPath),
    create: (filePath: string) => ipcRenderer.invoke('file:create', filePath),
    delete: (filePath: string) => ipcRenderer.invoke('file:delete', filePath),
    rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('file:rename', oldPath, newPath),
    reveal: (filePath: string) => ipcRenderer.invoke('file:reveal', filePath),
    addRecent: (filePath: string) => ipcRenderer.send('file:add-recent', filePath),
    mkdir: (dirPath: string) => ipcRenderer.invoke('file:mkdir', dirPath),
    getRecents: () => ipcRenderer.invoke('file:get-recents')
  },

  // Config operations
  config: {
    getDir: () => ipcRenderer.invoke('config:get-dir'),
    read: (name: string) => ipcRenderer.invoke('config:read', name),
    write: (name: string, data: object) => ipcRenderer.invoke('config:write', name, data),
    readRaw: (name: string) => ipcRenderer.invoke('config:read-raw', name),
    writeRaw: (name: string, content: string) => ipcRenderer.invoke('config:write-raw', name, content),
    listUDL: () => ipcRenderer.invoke('config:list-udl'),
    readUDL: (filename: string) => ipcRenderer.invoke('config:read-udl', filename),
    writeUDL: (filename: string, data: object) => ipcRenderer.invoke('config:write-udl', filename, data)
  },

  // Plugin operations
  plugin: {
    list: () => ipcRenderer.invoke('plugin:list'),
    reload: () => ipcRenderer.invoke('plugin:reload')
  },

  // Search operations
  search: {
    start: (opts: object) => ipcRenderer.invoke('search:find-in-files-start', opts),
    cancel: (searchId: string) => ipcRenderer.invoke('search:cancel', searchId)
  },

  // File watch operations
  watch: {
    add: (filePath: string) => ipcRenderer.invoke('watch:add', filePath),
    remove: (filePath: string) => ipcRenderer.invoke('watch:remove', filePath)
  },

  // App-level metadata
  app: {
    /** Reliable app version from app.getVersion() (preferred over the legacy appVersion constant). */
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version')
  },

  // IPC event listeners (main -> renderer)
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const allowedChannels = [
      'menu:file-new', 'menu:file-open', 'menu:file-save', 'menu:file-save-as',
      'menu:file-save-all', 'menu:file-close', 'menu:file-close-all', 'menu:file-reload',
      'menu:folder-open', 'menu:find', 'menu:replace', 'menu:find-in-files',
      'menu:settings-open', 'menu:shortcuts-open',
      'menu:plugin-manager', 'menu:about',
      'editor:command', 'editor:set-option', 'editor:set-language',
      'editor:set-encoding', 'editor:set-eol',
      'ui:toggle-toolbar', 'ui:toggle-statusbar', 'ui:toggle-sidebar',
      'ui:toggle-split-view', 'ui:toggle-theme', 'ui:show-toast',
      'tab:next', 'tab:prev',
      'macro:start-record', 'macro:stop-record', 'macro:playback',
      'session:restore', 'app:before-close',
      'plugin:add-menu-item', 'plugin:insert-text',
      'plugin:editor-get-text', 'plugin:editor-get-selection', 'plugin:editor-get-path',
      'file:externally-changed', 'file:externally-deleted',
      'search:chunk', 'search:progress', 'search:done'
    ]
    if (allowedChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args))
    }
  },

  off: (channel: string) => {
    const allowedChannels = [
      'menu:file-new', 'menu:file-open', 'menu:file-save', 'menu:file-save-as',
      'menu:file-save-all', 'menu:file-close', 'menu:file-close-all', 'menu:file-reload',
      'menu:folder-open', 'menu:find', 'menu:replace', 'menu:find-in-files',
      'menu:settings-open', 'menu:shortcuts-open',
      'menu:plugin-manager', 'menu:about',
      'editor:command', 'editor:set-option', 'editor:set-language',
      'editor:set-encoding', 'editor:set-eol',
      'ui:toggle-toolbar', 'ui:toggle-statusbar', 'ui:toggle-sidebar',
      'ui:toggle-split-view', 'ui:toggle-theme', 'ui:show-toast',
      'tab:next', 'tab:prev',
      'macro:start-record', 'macro:stop-record', 'macro:playback',
      'session:restore', 'app:before-close',
      'plugin:add-menu-item', 'plugin:insert-text',
      'plugin:editor-get-text', 'plugin:editor-get-selection', 'plugin:editor-get-path',
      'file:externally-changed', 'file:externally-deleted',
      'search:chunk', 'search:progress', 'search:done'
    ]
    if (allowedChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel)
    }
  },

  // Renderer -> main replies
  send: (channel: string, ...args: unknown[]) => {
    const allowedChannels = [
      'app:close-confirmed',
      'app:close-cancelled',
      'plugin:editor-get-text:reply',
      'plugin:editor-get-selection:reply',
      'plugin:editor-get-path:reply',
      'session:save',
      'ui:state-changed'
    ]
    if (allowedChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
