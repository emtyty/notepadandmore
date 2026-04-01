import React, { useRef, useEffect, useCallback, useState } from 'react'
import * as monaco from 'monaco-editor'
import { useEditorStore, EOLType } from '../../store/editorStore'
import { useUIStore } from '../../store/uiStore'
import { useConfigStore } from '../../store/configStore'
import { editorRegistry } from '../../utils/editorRegistry'
import { useBookmarks } from '../../hooks/useBookmarks'
import { useMacroRecorder } from '../../hooks/useMacroRecorder'
import { useFileOps } from '../../hooks/useFileOps'
import styles from './EditorPane.module.css'

interface EditorPaneProps {
  activeId?: string | null
}

export const EditorPane: React.FC<EditorPaneProps> = ({ activeId }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const { updateBuffer, getBuffer } = useEditorStore()
  const activeBufLoaded = useEditorStore((s) => s.buffers.find((b) => b.id === activeId)?.loaded)
  const { theme } = useUIStore()
  const { loadBuffer } = useFileOps()
  const currentIdRef = useRef<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [missingFile, setMissingFile] = useState<string | null>(null)

  const { toggleBookmark, nextBookmark, prevBookmark, clearBookmarks, restoreDecorations } = useBookmarks()
  const { start: macroStart, stop: macroStop, playback: macroPlayback, recordStep } = useMacroRecorder()

  // Extracted command dispatch — also called by macro:replay-command event
  const dispatchCommand = useCallback((command: string) => {
    const editor = editorRef.current
    if (!editor) return

    // Record command steps during macro recording
    if (useUIStore.getState().isRecording) {
      recordStep({ type: 'command', value: command })
    }

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
      case 'toggleBookmark': {
        const id = currentIdRef.current
        if (!id) break
        const lineNumber = editor.getPosition()?.lineNumber ?? 1
        toggleBookmark(id, lineNumber)
        break
      }
      case 'nextBookmark': {
        const id = currentIdRef.current
        if (!id) break
        const currentLine = editor.getPosition()?.lineNumber ?? 1
        const line = nextBookmark(id, currentLine)
        if (line != null) {
          editor.revealLineInCenter(line)
          editor.setPosition({ lineNumber: line, column: 1 })
          editor.focus()
        }
        break
      }
      case 'prevBookmark': {
        const id = currentIdRef.current
        if (!id) break
        const currentLine = editor.getPosition()?.lineNumber ?? 1
        const line = prevBookmark(id, currentLine)
        if (line != null) {
          editor.revealLineInCenter(line)
          editor.setPosition({ lineNumber: line, column: 1 })
          editor.focus()
        }
        break
      }
      case 'clearBookmarks': {
        const id = currentIdRef.current
        if (id) clearBookmarks(id)
        break
      }
      case 'toggleColumnSelect': {
        const current = editor.getOption(monaco.editor.EditorOption.columnSelection)
        editor.updateOptions({ columnSelection: !current })
        break
      }
    }
  }, [toggleBookmark, nextBookmark, prevBookmark, clearBookmarks, recordStep])

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return

    const cfg = useConfigStore.getState()
    const editor = monaco.editor.create(containerRef.current, {
      theme: theme === 'dark' ? 'vs-dark' : 'vs',
      fontSize: cfg.fontSize,
      fontFamily: cfg.fontFamily,
      lineNumbers: cfg.showLineNumbers ? 'on' : 'off',
      glyphMargin: true,
      folding: true,
      foldingHighlight: true,
      showFoldingControls: 'always',
      minimap: { enabled: cfg.showMinimap },
      scrollBeyondLastLine: false,
      wordWrap: cfg.wordWrap ? 'on' : 'off',
      renderWhitespace: cfg.renderWhitespace as monaco.editor.RenderWhitespace,
      renderControlCharacters: false,
      guides: { indentation: cfg.renderIndentGuides, bracketPairs: true },
      bracketPairColorization: { enabled: cfg.bracketPairColorization },
      autoClosingBrackets: cfg.autoCloseBrackets ? 'always' : 'never',
      autoClosingQuotes: cfg.autoCloseQuotes ? 'always' : 'never',
      suggestOnTriggerCharacters: cfg.autoCompleteEnabled,
      quickSuggestions: cfg.autoCompleteEnabled,
      parameterHints: { enabled: true },
      multiCursorModifier: 'alt',
      columnSelection: false,
      links: true,
      colorDecorators: true,
      renderLineHighlight: cfg.highlightCurrentLine ? 'line' : 'none',
      tabSize: cfg.tabSize,
      insertSpaces: cfg.insertSpaces,
      scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10
      },
      padding: { top: 4 }
    })

    editorRef.current = editor
    editorRegistry.set(editor)

    // Override Monaco's built-in Cmd+F / Ctrl+H to use our custom dialog
    // Pre-fill with current selection if it's a single-line non-empty string
    const getSelectionText = () => {
      const sel = editor.getSelection()
      if (!sel) return ''
      const text = editor.getModel()?.getValueInRange(sel) ?? ''
      return text.includes('\n') ? '' : text.trim()
    }
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      useUIStore.getState().openFind('find', getSelectionText())
    })
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => {
      useUIStore.getState().openFind('replace', getSelectionText())
    })

    // Track content changes -> mark dirty
    editor.onDidChangeModelContent(() => {
      const id = currentIdRef.current
      if (id) updateBuffer(id, { isDirty: true })
    })

    // Track cursor position -> status bar
    editor.onDidChangeCursorPosition((e) => {
      const id = currentIdRef.current
      if (id) {
        window.dispatchEvent(new CustomEvent('editor:cursor', {
          detail: { line: e.position.lineNumber, col: e.position.column }
        }))
      }
    })

    // Dispatch scroll event for Document Map sync
    editor.onDidScrollChange(() => {
      window.dispatchEvent(new CustomEvent('editor:scroll'))
    })

    // Handle resize
    const ro = new ResizeObserver(() => editor.layout())
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      editorRegistry.set(null)
      editor.dispose()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update theme
  useEffect(() => {
    if (editorRef.current) {
      monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs')
    }
  }, [theme])

  // Live-apply config changes from Preferences dialog
  useEffect(() => {
    const unsub = useConfigStore.subscribe((cfg) => {
      const editor = editorRef.current
      if (!editor) return
      editor.updateOptions({
        fontSize: cfg.fontSize,
        fontFamily: cfg.fontFamily,
        lineNumbers: cfg.showLineNumbers ? 'on' : 'off',
        wordWrap: cfg.wordWrap ? 'on' : 'off',
        renderWhitespace: cfg.renderWhitespace as monaco.editor.RenderWhitespace,
        guides: { indentation: cfg.renderIndentGuides, bracketPairs: true },
        bracketPairColorization: { enabled: cfg.bracketPairColorization },
        autoClosingBrackets: cfg.autoCloseBrackets ? 'always' : 'never',
        autoClosingQuotes: cfg.autoCloseQuotes ? 'always' : 'never',
        suggestOnTriggerCharacters: cfg.autoCompleteEnabled,
        quickSuggestions: cfg.autoCompleteEnabled,
        renderLineHighlight: cfg.highlightCurrentLine ? 'line' : 'none',
        tabSize: cfg.tabSize,
        insertSpaces: cfg.insertSpaces,
        minimap: { enabled: cfg.showMinimap }
      })
    })
    return unsub
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Swap model when active buffer changes (supports ghost/lazy buffers)
  // Also re-runs when activeBufLoaded flips from false→true after hydration
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
    setMissingFile(null)

    // Missing file — show placeholder
    if (buf.missing) {
      editor.setModel(null)
      setLoading(false)
      setMissingFile(buf.filePath)
      return
    }

    // Ghost buffer — trigger lazy load; effect will re-run when loaded becomes true
    if (!buf.loaded) {
      editor.setModel(null)
      setLoading(true)
      loadBuffer(activeId)
      return
    }

    // Loaded buffer — set model (handles both normal open and post-hydration)
    setLoading(false)
    if (buf.model) {
      editor.setModel(buf.model)
      // Prefer live viewState, fall back to savedViewState from session
      if (buf.viewState) {
        editor.restoreViewState(buf.viewState)
      } else if (buf.savedViewState) {
        try { editor.restoreViewState(buf.savedViewState as monaco.editor.ICodeEditorViewState) } catch { /* ignore */ }
      }
      restoreDecorations(activeId)
    }

    editor.focus()
  }, [activeId, activeBufLoaded, getBuffer, updateBuffer, restoreDecorations, loadBuffer])

  // Handle editor commands from menu
  useEffect(() => {
    const handler = (...args: unknown[]) => {
      dispatchCommand(args[0] as string)
    }
    window.api.on('editor:command', handler)
  }, [dispatchCommand])

  // Handle macro:replay-command from macro playback (avoids IPC round-trip)
  useEffect(() => {
    const handler = (e: Event) => {
      dispatchCommand((e as CustomEvent<string>).detail)
    }
    window.addEventListener('macro:replay-command', handler)
    return () => window.removeEventListener('macro:replay-command', handler)
  }, [dispatchCommand])

  // Handle macro IPC events
  useEffect(() => {
    window.api.on('macro:start-record', () => {
      const editor = editorRef.current
      if (editor) macroStart(editor)
    })
    window.api.on('macro:stop-record', () => {
      macroStop()
    })
    window.api.on('macro:playback', () => {
      const editor = editorRef.current
      if (editor) macroPlayback(editor)
    })
  }, [macroStart, macroStop, macroPlayback])

  // Handle editor option changes from menu
  useEffect(() => {
    window.api.on('editor:set-option', (...args: unknown[]) => {
      const opts = args[0] as monaco.editor.IEditorOptions
      editorRef.current?.updateOptions(opts)
    })
  }, [])

  // Handle EOL change from menu (IPC) or status bar click (CustomEvent)
  useEffect(() => {
    const applyEol = (eol: EOLType) => {
      const id = currentIdRef.current
      const editor = editorRef.current
      if (!id || !editor) return
      const monacoEol =
        eol === 'CRLF'
          ? monaco.editor.EndOfLineSequence.CRLF
          : monaco.editor.EndOfLineSequence.LF
      editor.getModel()?.setEOL(monacoEol)
      updateBuffer(id, { eol })
    }
    const ipcHandler = (...args: unknown[]) => applyEol(args[0] as EOLType)
    const customHandler = (e: Event) => applyEol((e as CustomEvent<EOLType>).detail)
    window.api.on('editor:set-eol', ipcHandler)
    window.addEventListener('editor:set-eol', customHandler)
    return () => window.removeEventListener('editor:set-eol', customHandler)
  }, [updateBuffer])

  // Handle encoding change from menu (IPC) or status bar click (CustomEvent)
  useEffect(() => {
    const applyEncoding = (encoding: string) => {
      const id = currentIdRef.current
      if (!id) return
      updateBuffer(id, { encoding, isDirty: true })
    }
    const ipcHandler = (...args: unknown[]) => applyEncoding(args[0] as string)
    const customHandler = (e: Event) => applyEncoding((e as CustomEvent<string>).detail)
    window.api.on('editor:set-encoding', ipcHandler)
    window.addEventListener('editor:set-encoding', customHandler)
    return () => window.removeEventListener('editor:set-encoding', customHandler)
  }, [updateBuffer])

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

  // Handle plugin API requests that need editor access
  useEffect(() => {
    window.api.on('plugin:editor-get-text', () => {
      const buf = currentIdRef.current ? getBuffer(currentIdRef.current) : null
      window.api.send('plugin:editor-get-text:reply', buf?.model?.getValue() ?? '')
    })
    window.api.on('plugin:editor-get-selection', () => {
      const editor = editorRef.current
      const selection = editor?.getSelection()
      const text = selection ? editor?.getModel()?.getValueInRange(selection) ?? '' : ''
      window.api.send('plugin:editor-get-selection:reply', text)
    })
    window.api.on('plugin:editor-get-path', () => {
      const buf = currentIdRef.current ? getBuffer(currentIdRef.current) : null
      window.api.send('plugin:editor-get-path:reply', buf?.filePath ?? null)
    })
    window.api.on('plugin:insert-text', (...args: unknown[]) => {
      const text = args[1] as string
      const editor = editorRef.current
      if (!editor || !text) return
      const selection = editor.getSelection()
      if (selection) {
        editor.executeEdits('plugin', [{ range: selection, text, forceMoveMarkers: true }])
      }
    })
  }, [getBuffer])

  return (
    <div className={styles.container} data-testid="editor-pane">
      <div ref={containerRef} className={styles.editor} />
      {loading && <div className={styles.overlay}>Loading...</div>}
      {missingFile && <div className={styles.overlay}>File not found: {missingFile}</div>}
    </div>
  )
}
