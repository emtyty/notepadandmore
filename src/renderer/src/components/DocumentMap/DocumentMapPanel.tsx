import React, { useRef, useEffect } from 'react'
import * as monaco from 'monaco-editor'
import { useEditorStore } from '../../store/editorStore'
import { editorRegistry } from '../../utils/editorRegistry'
import styles from './DocumentMapPanel.module.css'

export function DocumentMapPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const decorationsRef = useRef<string[]>([])
  const { activeId, getBuffer } = useEditorStore()

  // Initialize map editor once
  useEffect(() => {
    if (!containerRef.current) return

    const mapEditor = monaco.editor.create(containerRef.current, {
      readOnly: true,
      minimap: { enabled: false },
      lineNumbers: 'off',
      glyphMargin: false,
      folding: false,
      fontSize: 2,
      lineHeight: 3,
      scrollBeyondLastLine: false,
      scrollbar: { vertical: 'hidden', horizontal: 'hidden', handleMouseWheel: false },
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      renderLineHighlight: 'none',
      contextmenu: false,
      wordWrap: 'off',
      guides: { indentation: false },
      renderWhitespace: 'none',
      links: false,
      padding: { top: 0 }
    })
    mapEditorRef.current = mapEditor

    const ro = new ResizeObserver(() => mapEditor.layout())
    ro.observe(containerRef.current!)

    // Click on map → scroll main editor to that position
    mapEditor.onMouseDown((e) => {
      const lineNumber = e.target.position?.lineNumber
      if (lineNumber == null) return
      const mainEditor = editorRegistry.get()
      if (mainEditor) {
        mainEditor.revealLineInCenter(lineNumber)
        mainEditor.setPosition({ lineNumber, column: 1 })
        mainEditor.focus()
      }
    })

    return () => {
      ro.disconnect()
      mapEditor.dispose()
    }
  }, [])

  // Swap model when active buffer changes — share the same ITextModel
  useEffect(() => {
    const mapEditor = mapEditorRef.current
    if (!mapEditor) return
    if (!activeId) {
      mapEditor.setModel(null)
      return
    }
    const buf = getBuffer(activeId)
    if (buf?.model) {
      mapEditor.setModel(buf.model)
    }
  }, [activeId, getBuffer])

  // Sync scroll via CustomEvent dispatched from EditorPane
  useEffect(() => {
    const handleScroll = () => {
      const mapEditor = mapEditorRef.current
      const mainEditor = editorRegistry.get()
      if (!mapEditor || !mainEditor) return

      const visibleRanges = mainEditor.getVisibleRanges()
      if (!visibleRanges.length) return

      const startLine = visibleRanges[0].startLineNumber
      const endLine = visibleRanges[visibleRanges.length - 1].endLineNumber

      // Highlight viewport in map
      decorationsRef.current = mapEditor.deltaDecorations(decorationsRef.current, [{
        range: new monaco.Range(startLine, 1, endLine, 1),
        options: {
          isWholeLine: true,
          className: styles.viewportHighlight
        }
      }])

      // Keep visible range centered in map
      mapEditor.revealLine(Math.floor((startLine + endLine) / 2))
    }

    window.addEventListener('editor:scroll', handleScroll)
    return () => window.removeEventListener('editor:scroll', handleScroll)
  }, [])

  return (
    <div className={styles.container}>
      <div className={styles.header}>Document Map</div>
      <div ref={containerRef} className={styles.mapEditor} />
    </div>
  )
}
