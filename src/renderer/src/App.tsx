import React, { useEffect, useCallback, useRef } from 'react'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import { EditorPane } from './components/EditorPane/EditorPane'
import { TabBar } from './components/TabBar/TabBar'
import { ToolBar } from './components/ToolBar/ToolBar'
import { StatusBar } from './components/StatusBar/StatusBar'
import { useEditorStore } from './store/editorStore'
import { useUIStore } from './store/uiStore'
import { useFileOps } from './hooks/useFileOps'
import styles from './App.module.css'

export default function App() {
  const { activeId, buffers, setActive } = useEditorStore()
  const { theme, showToolbar, showStatusBar, showSidebar, toggleTheme } = useUIStore()
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
    window.api.on('ui:toggle-theme', () => toggleTheme())
    window.api.on('ui:toggle-toolbar', (...args) => useUIStore.getState().setShowToolbar(args[0] as boolean))
    window.api.on('ui:toggle-statusbar', (...args) => useUIStore.getState().setShowStatusBar(args[0] as boolean))
    window.api.on('ui:toggle-sidebar', (...args) => useUIStore.getState().setShowSidebar(args[0] as boolean))
    window.api.on('ui:show-toast', (...args) => {
      useUIStore.getState().addToast(args[0] as string, (args[1] as 'info' | 'warn' | 'error') ?? 'info')
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

    // Restore session
    window.api.on('session:restore', (...args) => {
      const session = args[0] as { files: Array<{ filePath: string }>; activeIndex: number }
      if (session?.files?.length) {
        openFiles(session.files.map((f) => f.filePath).filter(Boolean))
      }
    })

    // Before close: check for unsaved buffers
    window.api.on('app:before-close', () => {
      const dirty = useEditorStore.getState().buffers.filter((b) => b.isDirty)
      if (dirty.length > 0) {
        const names = dirty.map((b) => b.title).join(', ')
        if (!confirm(`Unsaved changes in: ${names}\n\nClose without saving?`)) return
      }
      window.api.send('app:close-confirmed')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // On startup: open with new untitled file if nothing loaded
  useEffect(() => {
    const timer = setTimeout(() => {
      if (useEditorStore.getState().buffers.length === 0) {
        newFile()
      }
    }, 800)
    return () => clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.app}>
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

      <div className={styles.workArea}>
        <PanelGroup direction="horizontal">
          {/* Main editor column */}
          <Panel defaultSize={100} minSize={30}>
            <div className={styles.editorColumn}>
              <TabBar onClose={closeBuffer} />
              <div className={styles.editorArea}>
                <EditorPane activeId={activeId} />
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {showStatusBar && <StatusBar />}

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
