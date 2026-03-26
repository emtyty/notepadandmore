import React, { useEffect, useRef } from 'react'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import { EditorPane } from './components/EditorPane/EditorPane'
import { TabBar } from './components/TabBar/TabBar'
import { ToolBar } from './components/ToolBar/ToolBar'
import { StatusBar } from './components/StatusBar/StatusBar'
import { BottomPanelContainer } from './components/Panels/BottomPanelContainer'
import { FindReplaceDialog } from './components/Dialogs/FindReplace/FindReplaceDialog'
import { PluginManagerDialog } from './components/Dialogs/PluginManager/PluginManagerDialog'
import { Sidebar } from './components/Sidebar/Sidebar'
import { useEditorStore } from './store/editorStore'
import { useUIStore } from './store/uiStore'
import { usePluginStore } from './store/pluginStore'
import { useFileOps } from './hooks/useFileOps'
import styles from './App.module.css'

export default function App() {
  const { activeId } = useEditorStore()
  const { theme, showToolbar, showStatusBar, toggleTheme, showBottomPanel, showSidebar } = useUIStore()
  const { openFiles, newFile, saveBuffer, saveActiveAs, closeBuffer, reloadBuffer } = useFileOps()
  const editorRef = useRef<{ focus: () => void } | null>(null)

  // Apply theme to root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

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
    window.api.on('menu:find', () => useUIStore.getState().openFind('find'))
    window.api.on('menu:replace', () => useUIStore.getState().openFind('replace'))
    window.api.on('menu:find-in-files', () => useUIStore.getState().openFind('findInFiles'))
    window.api.on('menu:folder-open', (...args) => {
      const folder = args[0] as string
      useUIStore.getState().setWorkspaceFolder(folder)
      useUIStore.getState().setShowSidebar(true)
      useUIStore.getState().setSidebarPanel('files')
    })
    window.api.on('ui:toggle-theme', () => toggleTheme())
    window.api.on('ui:toggle-toolbar', (...args) => useUIStore.getState().setShowToolbar(args[0] as boolean))
    window.api.on('ui:toggle-statusbar', (...args) => useUIStore.getState().setShowStatusBar(args[0] as boolean))
    window.api.on('ui:toggle-sidebar', (...args) => useUIStore.getState().setShowSidebar(args[0] as boolean))
    window.api.on('ui:show-toast', (...args) => {
      useUIStore.getState().addToast(args[0] as string, (args[1] as 'info' | 'warn' | 'error') ?? 'info')
    })
    window.api.on('menu:plugin-manager', () => useUIStore.getState().setShowPluginManager(true))
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

    // Restore session
    window.api.on('session:restore', (...args) => {
      const session = args[0] as { files: Array<{ filePath: string }>; activeIndex: number; workspaceFolder?: string }
      if (session?.files?.length) {
        openFiles(session.files.map((f) => f.filePath).filter(Boolean))
      }
      if (session?.workspaceFolder) {
        useUIStore.getState().setWorkspaceFolder(session.workspaceFolder)
      }
    })

    // Before close: check for unsaved buffers, then save session
    window.api.on('app:before-close', () => {
      const dirty = useEditorStore.getState().buffers.filter((b) => b.isDirty)
      if (dirty.length > 0) {
        const names = dirty.map((b) => b.title).join(', ')
        if (!confirm(`Unsaved changes in: ${names}\n\nClose without saving?`)) {
          window.api.send('app:close-cancelled')
          return
        }
      }
      // Save session before confirming close
      const state = useEditorStore.getState()
      const uiState = useUIStore.getState()
      window.api.send('session:save', {
        files: state.buffers
          .filter((b) => b.filePath)
          .map((b) => ({ filePath: b.filePath, cursorLine: 1, cursorColumn: 1, scrollTop: 0, language: b.language })),
        activeIndex: Math.max(0, state.buffers.findIndex((b) => b.id === state.activeId)),
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
      window.api.off('plugin:add-menu-item')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // On startup: open with new untitled file if nothing loaded; fetch plugin list
  useEffect(() => {
    const timer = setTimeout(() => {
      if (useEditorStore.getState().buffers.length === 0) {
        newFile()
      }
    }, 800)
    usePluginStore.getState().fetchPlugins()
    return () => clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.app} data-testid="app">
      {showToolbar && (
        <ToolBar
          onNew={newFile}
          onOpen={() => window.api.on('menu:file-open', () => {})} // triggered via menu
          onSave={() => { const id = useEditorStore.getState().activeId; if (id) saveBuffer(id) }}
          onSaveAll={() => useEditorStore.getState().buffers.forEach((b) => { if (b.isDirty) saveBuffer(b.id) })}
          onFind={() => useUIStore.getState().openFind('find')}
          onReplace={() => useUIStore.getState().openFind('replace')}
          onUndo={() => window.dispatchEvent(new CustomEvent('editor:undo'))}
          onRedo={() => window.dispatchEvent(new CustomEvent('editor:redo'))}
        />
      )}

      <PanelGroup direction="vertical" className={styles.mainPanelGroup}>
        {/* Editor area */}
        <Panel minSize={15}>
          <PanelGroup direction="horizontal">
            {showSidebar && (
              <>
                <Panel defaultSize={18} minSize={12} maxSize={40} className={styles.sidebarPanel}>
                  <Sidebar />
                </Panel>
                <PanelResizeHandle className={styles.hResizeHandle} />
              </>
            )}
            <Panel defaultSize={showSidebar ? 82 : 100} minSize={20}>
              <div className={styles.editorColumn}>
                <TabBar onClose={closeBuffer} />
                <div className={styles.editorArea}>
                  <EditorPane activeId={activeId} />
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </Panel>

        {/* Bottom panel (resizable) */}
        {showBottomPanel && (
          <>
            <PanelResizeHandle className={styles.vResizeHandle} />
            <Panel defaultSize={25} minSize={8} maxSize={70}>
              <BottomPanelContainer />
            </Panel>
          </>
        )}
      </PanelGroup>

      {showStatusBar && <StatusBar />}

      <FindReplaceDialog />
      <PluginManagerDialog />
      <ToastContainer />
    </div>
  )
}

function ToastContainer() {
  const { toasts, removeToast } = useUIStore()
  return (
    <div style={{ position: 'fixed', bottom: 32, right: 16, zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => removeToast(t.id)}
          style={{
            background: t.level === 'error' ? '#c0392b' : t.level === 'warn' ? '#e67e22' : '#2c3e50',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 6,
            fontSize: 13,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            maxWidth: 360
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
