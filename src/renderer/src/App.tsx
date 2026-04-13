import React, { useCallback, useEffect, useRef } from 'react'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import { EditorPane } from './components/EditorPane/EditorPane'
import { WelcomeScreen } from './components/WelcomeScreen/WelcomeScreen'
import { TabBar } from './components/TabBar/TabBar'
import { MenuBar } from './components/editor/MenuBar'
import { QuickStrip } from './components/editor/QuickStrip'
import { Toolbar } from './components/editor/Toolbar'
import { StatusBar } from './components/StatusBar/StatusBar'
import { BottomPanelContainer } from './components/Panels/BottomPanelContainer'
import { FindReplaceDialog } from './components/Dialogs/FindReplace/FindReplaceDialog'
import { PluginManagerDialog } from './components/Dialogs/PluginManager/PluginManagerDialog'
import { AboutDialog } from './components/Dialogs/AboutDialog/AboutDialog'
import { PreferencesDialog } from './components/Dialogs/Preferences/PreferencesDialog'
import { ShortcutMapperDialog } from './components/Dialogs/ShortcutMapper/ShortcutMapperDialog'
import { StyleConfiguratorDialog } from './components/Dialogs/StyleConfigurator/StyleConfiguratorDialog'
import { UDLEditorDialog } from './components/Dialogs/UDLEditor/UDLEditorDialog'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Toaster, toast } from './components/ui/sonner'
import { useEditorStore } from './store/editorStore'
import { useUIStore } from './store/uiStore'
import { usePluginStore } from './store/pluginStore'
import { useConfigStore } from './store/configStore'
import { useFileOps, SessionData } from './hooks/useFileOps'
import { editorRegistry } from './utils/editorRegistry'

export default function App() {
  const { activeId, buffers } = useEditorStore()
  const { theme, showToolbar, showStatusBar, showBottomPanel, showSidebar, openFind } = useUIStore()
  const { openFiles, newFile, saveBuffer, saveActiveAs, closeBuffer, reloadBuffer, loadBuffer, restoreSession } = useFileOps()
  const editorRef = useRef<{ focus: () => void } | null>(null)

  const handleOpenFile = useCallback(async () => {
    const filePaths = await window.api.file.openDialog()
    if (filePaths) openFiles(filePaths)
  }, [openFiles])

  // Apply theme to root — .dark class on <html> drives Tailwind theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  // Load config on startup and apply persisted theme to UI
  useEffect(() => {
    void (async () => {
      await useConfigStore.getState().load()
      const t = useConfigStore.getState().theme
      useUIStore.getState().setTheme(t)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Wire up menu IPC events
  useEffect(() => {
    window.api.on('menu:file-new', () => newFile())
    window.api.on('menu:file-open', (...args) => openFiles(args[0] as string[]))
    window.api.on('menu:file-save', () => {
      const id = useEditorStore.getState().activeId
      if (id) saveBuffer(id)
    })
    window.api.on('menu:file-save-as', () => saveActiveAs())
    window.api.on('menu:file-save-all', () => {
      useEditorStore.getState().buffers.forEach((b) => {
        if (b.isDirty) saveBuffer(b.id)
      })
    })
    window.api.on('menu:file-close', () => {
      const id = useEditorStore.getState().activeId
      if (id) closeBuffer(id)
    })
    window.api.on('menu:file-close-all', () => {
      useEditorStore.getState().buffers.forEach((b) => closeBuffer(b.id))
    })
    window.api.on('menu:file-reload', () => {
      const id = useEditorStore.getState().activeId
      if (id) reloadBuffer(id)
    })
    const getEditorSelection = () => {
      const editor = editorRegistry.get()
      if (!editor) return ''
      const sel = editor.getSelection()
      if (!sel) return ''
      const text = editor.getModel()?.getValueInRange(sel) ?? ''
      return text.includes('\n') ? '' : text.trim()
    }
    window.api.on('menu:find', () => useUIStore.getState().openFind('find', getEditorSelection()))
    window.api.on('menu:replace', () => useUIStore.getState().openFind('replace', getEditorSelection()))
    window.api.on('menu:find-in-files', () => useUIStore.getState().openFind('findInFiles'))
    window.api.on('menu:folder-open', (...args) => {
      const folder = args[0] as string
      useUIStore.getState().setWorkspaceFolder(folder)
      useUIStore.getState().setShowSidebar(true)
      useUIStore.getState().setSidebarPanel('files')
    })
    window.api.on('ui:toggle-theme', () => {
      useUIStore.getState().toggleTheme()
      useConfigStore.getState().setProp('theme', useUIStore.getState().theme)
    })
    window.api.on('ui:toggle-toolbar', (...args) => useUIStore.getState().setShowToolbar(args[0] as boolean, true))
    window.api.on('ui:toggle-statusbar', (...args) => useUIStore.getState().setShowStatusBar(args[0] as boolean, true))
    window.api.on('ui:toggle-sidebar', (...args) => useUIStore.getState().setShowSidebar(args[0] as boolean, true))
    window.api.on('ui:show-toast', (...args) => {
      useUIStore.getState().addToast(args[0] as string, (args[1] as 'info' | 'warn' | 'error') ?? 'info')
    })
    window.api.on('menu:plugin-manager', () => useUIStore.getState().setShowPluginManager(true))
    window.api.on('menu:preferences',        () => useUIStore.getState().setShowPreferences(true))
    window.api.on('menu:shortcut-mapper',    () => useUIStore.getState().setShowShortcutMapper(true))
    window.api.on('menu:udl-editor',         () => useUIStore.getState().setShowUDLEditor(true))
    window.api.on('menu:style-configurator', () => useUIStore.getState().setShowStyleConfigurator(true))
    window.api.on('menu:about',              () => useUIStore.getState().setShowAbout(true))
    window.api.on('plugin:add-menu-item', (...args) => {
      const [pluginName, label] = args as [string, string]
      usePluginStore.getState().addDynamicMenuItem({ pluginName, label })
    })
    window.api.on('tab:next', () => {
      const s = useEditorStore.getState()
      const idx = s.buffers.findIndex((b) => b.id === s.activeId)
      const next = s.buffers[(idx + 1) % s.buffers.length]
      if (next) s.setActive(next.id)
    })
    window.api.on('tab:prev', () => {
      const s = useEditorStore.getState()
      const idx = s.buffers.findIndex((b) => b.id === s.activeId)
      const prev = s.buffers[(idx - 1 + s.buffers.length) % s.buffers.length]
      if (prev) s.setActive(prev.id)
    })

    // Custom MenuBar events (Window menu)
    const handleTabNext = () => {
      const s = useEditorStore.getState()
      const idx = s.buffers.findIndex((b) => b.id === s.activeId)
      const next = s.buffers[(idx + 1) % s.buffers.length]
      if (next) s.setActive(next.id)
    }
    const handleTabPrev = () => {
      const s = useEditorStore.getState()
      const idx = s.buffers.findIndex((b) => b.id === s.activeId)
      const prev = s.buffers[(idx - 1 + s.buffers.length) % s.buffers.length]
      if (prev) s.setActive(prev.id)
    }
    window.addEventListener('tab:next-local', handleTabNext)
    window.addEventListener('tab:prev-local', handleTabPrev)

    // External file change notifications
    window.api.on('file:externally-changed', (...args) => {
      const fp = args[0] as string
      const buf = useEditorStore.getState().buffers.find((b) => b.filePath === fp)
      if (!buf) return
      if (buf.isDirty) {
        useUIStore.getState().addToast(`"${buf.title}" changed on disk. Use Reload to update.`, 'warn')
      } else {
        reloadBuffer(buf.id)
        useUIStore.getState().addToast(`"${buf.title}" reloaded (external change)`, 'info')
      }
    })
    window.api.on('file:externally-deleted', (...args) => {
      const fp = args[0] as string
      const buf = useEditorStore.getState().buffers.find((b) => b.filePath === fp)
      if (buf) useUIStore.getState().addToast(`"${buf.title}" was deleted from disk.`, 'warn')
    })

    // Restore session (lazy 2-phase: ghost buffers first, then load active tab)
    window.api.on('session:restore', (...args) => {
      const session = args[0] as SessionData
      if (session?.files?.length) {
        restoreSession(session)
      }
      if (session?.workspaceFolder) {
        useUIStore.getState().setWorkspaceFolder(session.workspaceFolder)
      }
    })

    // Before close: check for unsaved buffers, flush config, then save session
    window.api.on('app:before-close', async () => {
      const dirty = useEditorStore.getState().buffers.filter((b) => b.isDirty)
      if (dirty.length > 0) {
        const names = dirty.map((b) => b.title).join(', ')
        if (!confirm(`Unsaved changes in: ${names}\n\nClose without saving?`)) {
          window.api.send('app:close-cancelled')
          return
        }
      }
      await useConfigStore.getState().save()

      // Capture current editor's viewState before building session payload
      const editor = editorRegistry.get()
      const state = useEditorStore.getState()
      if (editor && state.activeId) {
        const vs = editor.saveViewState()
        if (vs) state.updateBuffer(state.activeId, { viewState: vs })
      }

      const freshState = useEditorStore.getState()
      const uiState = useUIStore.getState()

      // Session v3: virtualTabs first, then files. activeIndex is a flat index into virtualTabs++files.
      const virtualBuffers = freshState.buffers.filter((b) => b.kind === 'settings' || b.kind === 'shortcuts')
      const fileBuffers = freshState.buffers.filter((b) => b.kind === 'file' && b.filePath)

      let activeIndex = 0
      const active = freshState.buffers.find((b) => b.id === freshState.activeId)
      if (active) {
        if (active.kind === 'file') {
          const i = fileBuffers.findIndex((b) => b.id === active.id)
          activeIndex = i >= 0 ? virtualBuffers.length + i : 0
        } else {
          const i = virtualBuffers.findIndex((b) => b.id === active.id)
          activeIndex = i >= 0 ? i : 0
        }
      }

      window.api.send('session:save', {
        version: 3,
        files: fileBuffers.map((b) => ({
          filePath: b.filePath,
          language: b.language,
          encoding: b.encoding,
          eol: b.eol,
          // Use live viewState if available, fall back to savedViewState for ghost tabs
          viewState: b.viewState ? JSON.parse(JSON.stringify(b.viewState)) : b.savedViewState
        })),
        virtualTabs: virtualBuffers.map((b) => ({ kind: b.kind })),
        activeIndex,
        workspaceFolder: uiState.workspaceFolder
      })
      window.api.send('app:close-confirmed')
    })

    return () => {
      window.api.off('menu:file-new')
      window.api.off('menu:file-open')
      window.api.off('menu:file-save')
      window.api.off('menu:file-save-as')
      window.api.off('menu:file-save-all')
      window.api.off('menu:file-close')
      window.api.off('menu:file-close-all')
      window.api.off('menu:file-reload')
      window.api.off('menu:find')
      window.api.off('menu:replace')
      window.api.off('menu:find-in-files')
      window.api.off('ui:toggle-theme')
      window.api.off('ui:toggle-toolbar')
      window.api.off('ui:toggle-statusbar')
      window.api.off('ui:toggle-sidebar')
      window.api.off('ui:show-toast')
      window.api.off('tab:next')
      window.api.off('tab:prev')
      window.api.off('session:restore')
      window.api.off('app:before-close')
      window.api.off('menu:folder-open')
      window.api.off('file:externally-changed')
      window.api.off('file:externally-deleted')
      window.api.off('menu:plugin-manager')
      window.api.off('menu:preferences')
      window.api.off('menu:shortcut-mapper')
      window.api.off('menu:udl-editor')
      window.api.off('menu:style-configurator')
      window.api.off('menu:about')
      window.api.off('plugin:add-menu-item')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // On startup: fetch plugin list (welcome screen shown when no buffers)
  useEffect(() => {
    usePluginStore.getState().fetchPlugins()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // AutoSave: save dirty buffers on interval when enabled
  const { autoSaveEnabled, autoSaveIntervalMs } = useConfigStore()
  useEffect(() => {
    if (!autoSaveEnabled) return
    const timer = setInterval(() => {
      useEditorStore.getState().buffers
        .filter((b) => b.isDirty && b.filePath)
        .forEach((b) => saveBuffer(b.id))
    }, autoSaveIntervalMs)
    return () => clearInterval(timer)
  }, [autoSaveEnabled, autoSaveIntervalMs, saveBuffer])

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground" data-testid="app">
      {/* Menu Bar — Win/Linux only (returns null on macOS) */}
      <MenuBar
        onNew={newFile}
        onOpen={handleOpenFile}
        onOpenFolder={async () => {
          const dir = await window.api.file.openDirDialog()
          if (dir) {
            useUIStore.getState().setWorkspaceFolder(dir)
            useUIStore.getState().setShowSidebar(true)
            useUIStore.getState().setSidebarPanel('files')
          }
        }}
        onSave={() => { const id = useEditorStore.getState().activeId; if (id) saveBuffer(id) }}
        onSaveAs={() => saveActiveAs()}
        onSaveAll={() => useEditorStore.getState().buffers.forEach((b) => { if (b.isDirty) saveBuffer(b.id) })}
        onClose={() => { const id = useEditorStore.getState().activeId; if (id) closeBuffer(id) }}
        onCloseAll={() => useEditorStore.getState().buffers.forEach((b) => closeBuffer(b.id))}
        onFind={() => openFind('find')}
        onReplace={() => openFind('replace')}
        onFindInFiles={() => openFind('findInFiles')}
        onReload={() => { const id = useEditorStore.getState().activeId; if (id) reloadBuffer(id) }}
      />

      {/* QuickStrip — macOS only (separate row with app icon + quick actions) */}
      {window.api.platform === 'darwin' && (
        <QuickStrip
          onFind={() => openFind('find')}
          onToggleSidebar={() => useUIStore.getState().setShowSidebar(!useUIStore.getState().showSidebar)}
          onToggleTheme={() => {
            useUIStore.getState().toggleTheme()
            useConfigStore.getState().setProp('theme', useUIStore.getState().theme)
          }}
        />
      )}

      {/* Toolbar — conditional on showToolbar */}
      {showToolbar && (
        <Toolbar
          onNew={newFile}
          onOpen={handleOpenFile}
          onSave={() => { const id = useEditorStore.getState().activeId; if (id) saveBuffer(id) }}
          onSaveAll={() => useEditorStore.getState().buffers.forEach((b) => { if (b.isDirty) saveBuffer(b.id) })}
          onFind={() => openFind('find')}
          onReplace={() => openFind('replace')}
          onClose={() => { const id = useEditorStore.getState().activeId; if (id) closeBuffer(id) }}
        />
      )}

      <div className="flex flex-row flex-1 overflow-hidden">
        <PanelGroup direction="vertical" className="flex-1 overflow-hidden">
          {/* Editor area */}
          <Panel minSize={15}>
            <PanelGroup direction="horizontal">
              {showSidebar && (
                <>
                  <Panel defaultSize={18} minSize={12} maxSize={40} className="overflow-hidden">
                    <Sidebar />
                  </Panel>
                  <PanelResizeHandle className="w-1 bg-border cursor-col-resize shrink-0 transition-colors hover:bg-primary data-[resize-handle-active]:bg-primary" />
                </>
              )}
              <Panel defaultSize={showSidebar ? 82 : 100} minSize={20}>
                <div className="flex flex-col h-full overflow-hidden">
                  <TabBar onClose={closeBuffer} onNewFile={newFile} />
                  <div className="flex flex-1 overflow-hidden">
                    {buffers.length === 0 ? (
                      <WelcomeScreen
                        onNewFile={newFile}
                        onOpenFile={handleOpenFile}
                        onOpenRecent={openFiles}
                      />
                    ) : (
                      <EditorPane activeId={activeId} />
                    )}
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          {/* Bottom panel (resizable) */}
          {showBottomPanel && (
            <>
              <PanelResizeHandle className="h-1 bg-border cursor-row-resize shrink-0 transition-colors hover:bg-primary data-[resize-handle-active]:bg-primary" />
              <Panel defaultSize={25} minSize={8} maxSize={70}>
                <BottomPanelContainer />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      {showStatusBar && buffers.length > 0 && <StatusBar />}

      <FindReplaceDialog />
      <PluginManagerDialog />
      <AboutDialog />
      <PreferencesDialog />
      <ShortcutMapperDialog />
      <StyleConfiguratorDialog />
      <UDLEditorDialog />
      <Toaster position="bottom-right" richColors closeButton />
      <SonnerBridge />
    </div>
  )
}

/** Bridge uiStore.addToast() calls to Sonner */
function SonnerBridge() {
  const seenRef = useRef(new Set<string>())
  useEffect(() => {
    const unsub = useUIStore.subscribe((state) => {
      for (const t of state.toasts) {
        if (!seenRef.current.has(t.id)) {
          seenRef.current.add(t.id)
          if (t.level === 'error') toast.error(t.message)
          else if (t.level === 'warn') toast.warning(t.message)
          else toast.info(t.message)
          // Auto-remove from uiStore since Sonner manages display lifecycle
          setTimeout(() => useUIStore.getState().removeToast(t.id), 100)
        }
      }
    })
    return unsub
  }, [])
  return null
}
