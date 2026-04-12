import { Menu, MenuItem, BrowserWindow, app, dialog } from 'electron'

export function buildMenu(win: BrowserWindow, recentFiles: string[] = []): void {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),

    // File
    {
      label: '&File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => win.webContents.send('menu:file-new')
        },
        { type: 'separator' },
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(win, {
              properties: ['openFile', 'multiSelections'],
              filters: [
                { name: 'All Files', extensions: ['*'] },
                { name: 'Text Files', extensions: ['txt', 'md', 'log'] },
                { name: 'Source Code', extensions: ['js', 'ts', 'jsx', 'tsx', 'py', 'cpp', 'c', 'h', 'java', 'cs', 'go', 'rs'] }
              ]
            })
            if (!result.canceled) {
              win.webContents.send('menu:file-open', result.filePaths)
            }
          }
        },
        {
          label: 'Open Folder...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            const result = await dialog.showOpenDialog(win, {
              properties: ['openDirectory']
            })
            if (!result.canceled) {
              win.webContents.send('menu:folder-open', result.filePaths[0])
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => win.webContents.send('menu:file-save')
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => win.webContents.send('menu:file-save-as')
        },
        {
          label: 'Save All',
          accelerator: 'CmdOrCtrl+Alt+S',
          click: () => win.webContents.send('menu:file-save-all')
        },
        { type: 'separator' },
        {
          label: 'Reload from Disk',
          accelerator: 'CmdOrCtrl+R',
          click: () => win.webContents.send('menu:file-reload')
        },
        { type: 'separator' },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          click: () => win.webContents.send('menu:file-close')
        },
        {
          label: 'Close All',
          click: () => win.webContents.send('menu:file-close-all')
        },
        { type: 'separator' },
        {
          label: 'Recent Files',
          submenu: recentFiles.length
            ? recentFiles.map((f) => ({ label: f, click: () => win.webContents.send('menu:file-open', [f]) }))
            : [{ label: 'No recent files', enabled: false }],
          id: 'recent-files'
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const }
      ]
    },

    // Edit
    {
      label: '&Edit',
      submenu: [
        { role: 'undo' as const, accelerator: 'CmdOrCtrl+Z' },
        { role: 'redo' as const, accelerator: 'CmdOrCtrl+Y' },
        { type: 'separator' },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
        { type: 'separator' },
        {
          label: 'Line Operations',
          submenu: [
            { label: 'Duplicate Line', accelerator: 'CmdOrCtrl+D', click: () => win.webContents.send('editor:command', 'duplicateLine') },
            { label: 'Delete Line', accelerator: 'CmdOrCtrl+Shift+K', click: () => win.webContents.send('editor:command', 'deleteLine') },
            { label: 'Move Line Up', accelerator: 'Alt+Up', click: () => win.webContents.send('editor:command', 'moveLineUp') },
            { label: 'Move Line Down', accelerator: 'Alt+Down', click: () => win.webContents.send('editor:command', 'moveLineDown') },
            { type: 'separator' },
            { label: 'Sort Lines Ascending', click: () => win.webContents.send('editor:command', 'sortLinesAsc') },
            { label: 'Sort Lines Descending', click: () => win.webContents.send('editor:command', 'sortLinesDesc') }
          ]
        },
        {
          label: 'Convert Case',
          submenu: [
            { label: 'UPPERCASE', accelerator: 'CmdOrCtrl+Shift+U', click: () => win.webContents.send('editor:command', 'toUpperCase') },
            { label: 'lowercase', accelerator: 'CmdOrCtrl+U', click: () => win.webContents.send('editor:command', 'toLowerCase') },
            { label: 'Title Case', click: () => win.webContents.send('editor:command', 'toTitleCase') }
          ]
        },
        { type: 'separator' },
        {
          label: 'Toggle Comment',
          accelerator: 'CmdOrCtrl+/',
          click: () => win.webContents.send('editor:command', 'toggleComment')
        },
        {
          label: 'Toggle Block Comment',
          accelerator: 'CmdOrCtrl+Shift+/',
          click: () => win.webContents.send('editor:command', 'toggleBlockComment')
        },
        { type: 'separator' },
        {
          label: 'Trim Trailing Whitespace',
          click: () => win.webContents.send('editor:command', 'trimTrailingWhitespace')
        },
        {
          label: 'Indent Selection',
          accelerator: 'Tab',
          click: () => win.webContents.send('editor:command', 'indentSelection')
        },
        {
          label: 'Outdent Selection',
          accelerator: 'Shift+Tab',
          click: () => win.webContents.send('editor:command', 'outdentSelection')
        }
      ]
    },

    // Search
    {
      label: '&Search',
      submenu: [
        {
          label: 'Find...',
          accelerator: 'CmdOrCtrl+F',
          click: () => win.webContents.send('menu:find')
        },
        {
          label: 'Replace...',
          accelerator: 'CmdOrCtrl+H',
          click: () => win.webContents.send('menu:replace')
        },
        {
          label: 'Find in Files...',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => win.webContents.send('menu:find-in-files')
        },
        { type: 'separator' },
        {
          label: 'Go to Line...',
          accelerator: 'CmdOrCtrl+G',
          click: () => win.webContents.send('editor:command', 'goToLine')
        },
        { type: 'separator' },
        {
          label: 'Toggle Bookmark',
          accelerator: 'CmdOrCtrl+F2',
          enabled: false,
          click: () => win.webContents.send('editor:command', 'toggleBookmark')
        },
        {
          label: 'Next Bookmark',
          accelerator: 'F2',
          enabled: false,
          click: () => win.webContents.send('editor:command', 'nextBookmark')
        },
        {
          label: 'Previous Bookmark',
          accelerator: 'Shift+F2',
          enabled: false,
          click: () => win.webContents.send('editor:command', 'prevBookmark')
        },
        { label: 'Clear All Bookmarks', enabled: false, click: () => win.webContents.send('editor:command', 'clearBookmarks') }
      ]
    },

    // View
    {
      label: '&View',
      submenu: [
        {
          id: 'toggle-toolbar',
          label: 'Toggle Toolbar',
          type: 'checkbox',
          checked: true,
          click: (item) => win.webContents.send('ui:toggle-toolbar', item.checked)
        },
        {
          id: 'toggle-statusbar',
          label: 'Toggle Status Bar',
          type: 'checkbox',
          checked: true,
          click: (item) => win.webContents.send('ui:toggle-statusbar', item.checked)
        },
        {
          id: 'toggle-sidebar',
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          type: 'checkbox',
          checked: true,
          click: (item) => win.webContents.send('ui:toggle-sidebar', item.checked)
        },
        { type: 'separator' },
        {
          id: 'toggle-word-wrap',
          label: 'Word Wrap',
          accelerator: 'Alt+Z',
          type: 'checkbox',
          checked: false,
          click: (item) => win.webContents.send('editor:set-option', { wordWrap: item.checked ? 'on' : 'off' })
        },
        {
          id: 'toggle-whitespace',
          label: 'Show Whitespace',
          type: 'checkbox',
          checked: false,
          click: (item) => win.webContents.send('editor:set-option', { renderWhitespace: item.checked ? 'all' : 'none' })
        },
        {
          id: 'toggle-indent-guides',
          label: 'Show Indentation Guides',
          type: 'checkbox',
          checked: true,
          click: (item) => win.webContents.send('editor:set-option', { guides: { indentation: item.checked } })
        },
        {
          label: 'Column Select Mode',
          id: 'column-select',
          type: 'checkbox',
          checked: false,
          click: () => win.webContents.send('editor:command', 'toggleColumnSelect')
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: () => win.webContents.send('editor:command', 'zoomIn')
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => win.webContents.send('editor:command', 'zoomOut')
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => win.webContents.send('editor:command', 'zoomReset')
        },
        { type: 'separator' },
        {
          id: 'toggle-split-view',
          label: 'Split View',
          type: 'checkbox',
          checked: false,
          enabled: false,
          click: (item) => win.webContents.send('ui:toggle-split-view', item.checked)
        }
      ]
    },

    // Encoding
    {
      label: 'E&ncoding',
      submenu: [
        { label: 'UTF-8', click: () => win.webContents.send('editor:set-encoding', 'utf8') },
        { label: 'UTF-8 with BOM', click: () => win.webContents.send('editor:set-encoding', 'utf8bom') },
        { label: 'UTF-16 LE', click: () => win.webContents.send('editor:set-encoding', 'utf16le') },
        { label: 'UTF-16 BE', click: () => win.webContents.send('editor:set-encoding', 'utf16be') },
        { type: 'separator' },
        { label: 'Windows-1252 (Latin)', click: () => win.webContents.send('editor:set-encoding', 'win1252') },
        { label: 'ISO-8859-1 (Latin-1)', click: () => win.webContents.send('editor:set-encoding', 'iso88591') },
        { type: 'separator' },
        {
          label: 'EOL Format',
          submenu: [
            { label: 'Windows (CRLF)', click: () => win.webContents.send('editor:set-eol', 'CRLF') },
            { label: 'Unix (LF)', click: () => win.webContents.send('editor:set-eol', 'LF') },
            { label: 'Classic Mac (CR)', click: () => win.webContents.send('editor:set-eol', 'CR') }
          ]
        }
      ]
    },

    // Language
    {
      label: '&Language',
      id: 'language-menu',
      submenu: [
        { label: 'Auto Detect', click: () => win.webContents.send('editor:set-language', 'auto') },
        { label: 'Plain Text', click: () => win.webContents.send('editor:set-language', 'plaintext') },
        { type: 'separator' },
        { label: 'JavaScript', click: () => win.webContents.send('editor:set-language', 'javascript') },
        { label: 'TypeScript', click: () => win.webContents.send('editor:set-language', 'typescript') },
        { label: 'Python', click: () => win.webContents.send('editor:set-language', 'python') },
        { label: 'C++', click: () => win.webContents.send('editor:set-language', 'cpp') },
        { label: 'C', click: () => win.webContents.send('editor:set-language', 'c') },
        { label: 'C#', click: () => win.webContents.send('editor:set-language', 'csharp') },
        { label: 'Java', click: () => win.webContents.send('editor:set-language', 'java') },
        { label: 'Go', click: () => win.webContents.send('editor:set-language', 'go') },
        { label: 'Rust', click: () => win.webContents.send('editor:set-language', 'rust') },
        { label: 'HTML', click: () => win.webContents.send('editor:set-language', 'html') },
        { label: 'CSS', click: () => win.webContents.send('editor:set-language', 'css') },
        { label: 'JSON', click: () => win.webContents.send('editor:set-language', 'json') },
        { label: 'XML', click: () => win.webContents.send('editor:set-language', 'xml') },
        { label: 'Markdown', click: () => win.webContents.send('editor:set-language', 'markdown') },
        { label: 'SQL', click: () => win.webContents.send('editor:set-language', 'sql') },
        { label: 'Shell Script', click: () => win.webContents.send('editor:set-language', 'shell') },
        { label: 'PowerShell', click: () => win.webContents.send('editor:set-language', 'powershell') },
        { label: 'YAML', click: () => win.webContents.send('editor:set-language', 'yaml') },
        { label: 'PHP', click: () => win.webContents.send('editor:set-language', 'php') },
        { label: 'Ruby', click: () => win.webContents.send('editor:set-language', 'ruby') }
      ]
    },

    // Settings
    {
      label: '&Settings',
      submenu: [
        {
          label: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: () => win.webContents.send('menu:preferences')
        },
        {
          label: 'Shortcut Mapper...',
          enabled: false,
          click: () => win.webContents.send('menu:shortcut-mapper')
        },
        { type: 'separator' },
        {
          label: 'User Defined Languages...',
          enabled: false,
          click: () => win.webContents.send('menu:udl-editor')
        },
        {
          label: 'Style Configurator...',
          enabled: false,
          click: () => win.webContents.send('menu:style-configurator')
        },
        { type: 'separator' },
        {
          label: 'Toggle Dark Mode',
          click: () => win.webContents.send('ui:toggle-theme')
        }
      ]
    },

    // Macro
    {
      label: '&Macro',
      submenu: [
        {
          label: 'Start Recording',
          accelerator: 'CmdOrCtrl+Shift+R',
          enabled: false,
          click: () => win.webContents.send('macro:start-record')
        },
        {
          label: 'Stop Recording',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => win.webContents.send('macro:stop-record'),
          enabled: false,
          id: 'macro-stop'
        },
        {
          label: 'Playback',
          accelerator: 'CmdOrCtrl+Shift+P',
          enabled: false,
          click: () => win.webContents.send('macro:playback')
        },
        { type: 'separator' },
        { label: 'Saved Macros', submenu: [{ label: 'No macros saved', enabled: false }], id: 'saved-macros' }
      ]
    },

    // Plugins
    {
      label: '&Plugins',
      id: 'plugins-menu',
      submenu: [
        {
          label: 'Plugin Manager...',
          enabled: false,
          click: () => win.webContents.send('menu:plugin-manager')
        },
        { type: 'separator' }
        // Plugin menu items added dynamically by PluginLoader
      ]
    },

    // Window
    {
      label: '&Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        { type: 'separator' },
        {
          label: 'Next Tab',
          accelerator: 'CmdOrCtrl+Tab',
          click: () => win.webContents.send('tab:next')
        },
        {
          label: 'Previous Tab',
          accelerator: 'CmdOrCtrl+Shift+Tab',
          click: () => win.webContents.send('tab:prev')
        },
        ...(isMac ? [{ type: 'separator' as const }, { role: 'front' as const }] : [])
      ]
    },

    // Help
    {
      label: '&Help',
      submenu: [
        {
          label: 'About NovaPad',
          click: () => win.webContents.send('menu:about')
        },
        { type: 'separator' },
        {
          label: 'Open DevTools',
          accelerator: 'F12',
          click: () => win.webContents.toggleDevTools()
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

export function updateRecentFiles(win: BrowserWindow, files: string[]): void {
  // Menus are immutable after creation — rebuild the whole menu with updated recents
  buildMenu(win, files)
}

export function addPluginMenuItem(
  win: BrowserWindow,
  pluginName: string,
  items: Array<{ label: string; callback: () => void }>
): void {
  const menu = Menu.getApplicationMenu()
  if (!menu) return
  const pluginsMenu = menu.getMenuItemById('plugins-menu')
  if (!pluginsMenu?.submenu) return

  const pluginSubmenu = items.map((item) => ({
    label: item.label,
    click: item.callback
  }))

  pluginsMenu.submenu.append(
    new MenuItem({
      label: pluginName,
      submenu: Menu.buildFromTemplate(pluginSubmenu)
    })
  )
}
