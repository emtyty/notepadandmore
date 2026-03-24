import React, { useRef, useEffect, useCallback } from 'react'
import * as monaco from 'monaco-editor'
import { useEditorStore } from '../../store/editorStore'
import { useUIStore } from '../../store/uiStore'
import { useBookmarks } from '../../hooks/useBookmarks'
import { useMacros } from '../../hooks/useMacros'
import { EditorContext } from '../../context/EditorContext'
import { FindReplace } from '../FindReplace/FindReplace'
import styles from './EditorPane.module.css'

interface EditorPaneProps {
  activeId?: string | null
}

export const EditorPane: React.FC<EditorPaneProps> = ({ activeId }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const { buffers, updateBuffer, getBuffer } = useEditorStore()
  const { theme } = useUIStore()
  const currentIdRef = useRef<string | null>(null)
  const bookmarks = useBookmarks(editorRef, activeId ?? null)
  const macros = useMacros(editorRef)

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return

    const editor = monaco.editor.create(containerRef.current, {
      theme: theme === 'dark' ? 'vs-dark' : 'vs',
      fontSize: 14,
      fontFamily: "'Cascadia Code', 'Fira Code', Consolas, 'Courier New', monospace",
      lineNumbers: 'on',
      glyphMargin: true,
      folding: true,
      foldingHighlight: true,
      showFoldingControls: 'always',
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      renderWhitespace: 'none',
      renderControlCharacters: false,
      guides: { indentation: true, bracketPairs: true },
      bracketPairColorization: { enabled: true },
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      suggestOnTriggerCharacters: true,
      quickSuggestions: true,
      parameterHints: { enabled: true },
      multiCursorModifier: 'alt',
      columnSelection: false,
      links: true,
      colorDecorators: true,
      scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10
      },
      padding: { top: 4 }
    })

    editorRef.current = editor

    // Track content changes -> mark dirty
    editor.onDidChangeModelContent(() => {
      const id = currentIdRef.current
      if (id) updateBuffer(id, { isDirty: true })
    })

    // Track cursor position -> status bar
    editor.onDidChangeCursorPosition((e) => {
      const id = currentIdRef.current
      if (id) {
        // Dispatch custom event for status bar
        window.dispatchEvent(new CustomEvent('editor:cursor', {
          detail: { line: e.position.lineNumber, col: e.position.column }
        }))
      }
    })

    // Handle resize
    const ro = new ResizeObserver(() => editor.layout())
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      editor.dispose()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update theme
  useEffect(() => {
    if (editorRef.current) {
      monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs')
    }
  }, [theme])

  // Swap model when active buffer changes
  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !activeId) return

    const buf = getBuffer(activeId)
    if (!buf) return

    // Save view state of previous buffer
    if (currentIdRef.current && currentIdRef.current !== activeId) {
      const vs = editor.saveViewState()
      updateBuffer(currentIdRef.current, { viewState: vs })
    }

    currentIdRef.current = activeId

    if (buf.model) {
      editor.setModel(buf.model)
      if (buf.viewState) editor.restoreViewState(buf.viewState)
    }

    editor.focus()
  }, [activeId, getBuffer, updateBuffer])

  // Handle editor commands from menu (and macro replay)
  const executeCommand = useCallback((command: string) => {
    const editor = editorRef.current
    if (!editor) return

    // Record command for macros
    macros.recordCommand(command)

    switch (command) {
        case 'duplicateLine':
          editor.getAction('editor.action.copyLinesDownAction')?.run()
          break
        case 'deleteLine':
          editor.getAction('editor.action.deleteLines')?.run()
          break
        case 'moveLineUp':
          editor.getAction('editor.action.moveLinesUpAction')?.run()
          break
        case 'moveLineDown':
          editor.getAction('editor.action.moveLinesDownAction')?.run()
          break
        case 'toUpperCase':
          editor.getAction('editor.action.transformToUppercase')?.run()
          break
        case 'toLowerCase':
          editor.getAction('editor.action.transformToLowercase')?.run()
          break
        case 'toTitleCase':
          editor.getAction('editor.action.transformToTitlecase')?.run()
          break
        case 'toggleComment':
          editor.getAction('editor.action.commentLine')?.run()
          break
        case 'toggleBlockComment':
          editor.getAction('editor.action.blockComment')?.run()
          break
        case 'trimTrailingWhitespace':
          editor.getAction('editor.action.trimTrailingWhitespace')?.run()
          break
        case 'goToLine':
          editor.getAction('editor.action.gotoLine')?.run()
          break
        case 'zoomIn':
          editor.trigger('keyboard', 'editor.action.fontZoomIn', {})
          break
        case 'zoomOut':
          editor.trigger('keyboard', 'editor.action.fontZoomOut', {})
          break
        case 'zoomReset':
          editor.trigger('keyboard', 'editor.action.fontZoomReset', {})
          break
        case 'sortLinesAsc':
          editor.getAction('editor.action.sortLinesAscending')?.run()
          break
        case 'sortLinesDesc':
          editor.getAction('editor.action.sortLinesDescending')?.run()
          break
        case 'indentSelection':
          editor.getAction('editor.action.indentLines')?.run()
          break
        case 'outdentSelection':
          editor.getAction('editor.action.outdentLines')?.run()
          break
        case 'toggleBookmark': {
          const line = editor.getPosition()?.lineNumber
          if (line) bookmarks.toggle(line)
          break
        }
        case 'nextBookmark': {
          const line = editor.getPosition()?.lineNumber ?? 1
          bookmarks.next(line)
          break
        }
        case 'prevBookmark': {
          const line = editor.getPosition()?.lineNumber ?? 1
          bookmarks.prev(line)
          break
        }
        case 'clearBookmarks':
          bookmarks.clearAll()
          break
      }
  }, [bookmarks, macros])

  useEffect(() => {
    const handler = (...args: unknown[]) => {
      executeCommand(args[0] as string)
    }
    window.api.on('editor:command', handler)

    // Also listen for macro replay commands
    const replayHandler = (e: Event) => {
      const { command } = (e as CustomEvent).detail
      executeCommand(command)
    }
    window.addEventListener('macro:replay-command', replayHandler)

    return () => {
      window.removeEventListener('macro:replay-command', replayHandler)
    }
  }, [executeCommand])

  // Handle EOL change from menu
  useEffect(() => {
    window.api.on('editor:set-eol', (...args: unknown[]) => {
      const eol = args[0] as string
      const id = currentIdRef.current
      const editor = editorRef.current
      if (!id || !editor) return
      const model = editor.getModel()
      if (model && eol !== 'CR') {
        const seq = eol === 'CRLF'
          ? monaco.editor.EndOfLineSequence.CRLF
          : monaco.editor.EndOfLineSequence.LF
        model.setEOL(seq)
      }
      updateBuffer(id, { eol: eol as import('../../store/editorStore').EOLType })
    })
  }, [updateBuffer])

  // Handle encoding change from menu
  useEffect(() => {
    window.api.on('editor:set-encoding', (...args: unknown[]) => {
      const encoding = args[0] as string
      const id = currentIdRef.current
      if (!id) return
      updateBuffer(id, { encoding })
    })
  }, [updateBuffer])

  // Handle editor option changes from menu
  useEffect(() => {
    window.api.on('editor:set-option', (...args: unknown[]) => {
      const opts = args[0] as monaco.editor.IEditorOptions
      editorRef.current?.updateOptions(opts)
    })
  }, [])

  // Handle language change from menu
  useEffect(() => {
    window.api.on('editor:set-language', (...args: unknown[]) => {
      const lang = args[0] as string
      const buf = currentIdRef.current ? getBuffer(currentIdRef.current) : null
      if (buf?.model) {
        monaco.editor.setModelLanguage(buf.model, lang)
        updateBuffer(buf.id, { language: lang })
      }
    })
  }, [getBuffer, updateBuffer])

  // Handle macro IPC events
  useEffect(() => {
    window.api.on('macro:start-record', () => macros.startRecording())
    window.api.on('macro:stop-record', () => macros.stopRecording())
    window.api.on('macro:playback', () => macros.playback())
  }, [macros])

  // Handle "go to line" from Find in Files results
  useEffect(() => {
    const handler = (e: Event) => {
      const { line } = (e as CustomEvent).detail
      const editor = editorRef.current
      if (editor && line) {
        editor.setPosition({ lineNumber: line, column: 1 })
        editor.revealLineInCenter(line)
        editor.focus()
      }
    }
    window.addEventListener('find-result:goto', handler)
    return () => window.removeEventListener('find-result:goto', handler)
  }, [])

  // Suppress built-in find widget — our custom one replaces it
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    // Override Ctrl+F and Ctrl+H to use our custom Find/Replace
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      useUIStore.getState().openFind('find')
    })
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => {
      useUIStore.getState().openFind('replace')
    })
  }, [])

  return (
    <EditorContext.Provider value={editorRef}>
      <div className={styles.container}>
        <FindReplace />
        <div ref={containerRef} className={styles.editor} />
      </div>
    </EditorContext.Provider>
  )
}
