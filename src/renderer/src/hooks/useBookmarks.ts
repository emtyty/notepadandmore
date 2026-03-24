import { useCallback, useRef, useEffect } from 'react'
import * as monaco from 'monaco-editor'
import { useEditorStore } from '../store/editorStore'

export function useBookmarks(
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>,
  bufferId: string | null
) {
  const { updateBuffer, getBuffer } = useEditorStore()
  const decorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null)

  const applyDecorations = useCallback(() => {
    const editor = editorRef.current
    if (!editor || !bufferId) return
    const buf = getBuffer(bufferId)
    if (!buf) return

    const decorations = buf.bookmarks.map((line) => ({
      range: new monaco.Range(line, 1, line, 1),
      options: { glyphMarginClassName: 'bookmark-glyph', isWholeLine: true }
    }))

    if (decorationsRef.current) {
      decorationsRef.current.set(decorations)
    } else {
      decorationsRef.current = editor.createDecorationsCollection(decorations)
    }
  }, [editorRef, bufferId, getBuffer])

  // Reapply decorations when buffer changes
  useEffect(() => {
    decorationsRef.current = null
    applyDecorations()
  }, [bufferId, applyDecorations])

  const toggle = useCallback((line: number) => {
    if (!bufferId) return
    const buf = getBuffer(bufferId)
    if (!buf) return
    const existing = buf.bookmarks.indexOf(line)
    const bookmarks = existing >= 0
      ? buf.bookmarks.filter((l) => l !== line)
      : [...buf.bookmarks, line].sort((a, b) => a - b)
    updateBuffer(bufferId, { bookmarks })
    // Apply decorations after state update
    setTimeout(() => applyDecorations(), 0)
  }, [bufferId, getBuffer, updateBuffer, applyDecorations])

  const next = useCallback((currentLine: number) => {
    const editor = editorRef.current
    if (!bufferId || !editor) return
    const buf = getBuffer(bufferId)
    if (!buf || buf.bookmarks.length === 0) return
    const nextLine = buf.bookmarks.find((l) => l > currentLine) ?? buf.bookmarks[0]
    editor.setPosition({ lineNumber: nextLine, column: 1 })
    editor.revealLineInCenter(nextLine)
  }, [editorRef, bufferId, getBuffer])

  const prev = useCallback((currentLine: number) => {
    const editor = editorRef.current
    if (!bufferId || !editor) return
    const buf = getBuffer(bufferId)
    if (!buf || buf.bookmarks.length === 0) return
    const reversed = [...buf.bookmarks].reverse()
    const prevLine = reversed.find((l) => l < currentLine) ?? reversed[0]
    editor.setPosition({ lineNumber: prevLine, column: 1 })
    editor.revealLineInCenter(prevLine)
  }, [editorRef, bufferId, getBuffer])

  const clearAll = useCallback(() => {
    if (!bufferId) return
    updateBuffer(bufferId, { bookmarks: [] })
    if (decorationsRef.current) {
      decorationsRef.current.set([])
    }
  }, [bufferId, updateBuffer])

  return { toggle, next, prev, clearAll }
}
