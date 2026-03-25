import { useCallback, useEffect } from 'react'
import * as monaco from 'monaco-editor'
import { useEditorStore } from '../store/editorStore'
import { useUIStore } from '../store/uiStore'
import { injectMarkStyles } from './useSearchEngine'

// Per-buffer decoration IDs (keyed by bufferId → decorationIds[])
// Separate from _bookmarkIds in useSearchEngine which tracks search-result bookmarks
const _decoIds = new Map<string, string[]>()

export function useBookmarks() {
  const { updateBuffer, getBuffer } = useEditorStore()
  const { addToast } = useUIStore()

  useEffect(() => {
    injectMarkStyles()
  }, [])

  const syncDecorations = useCallback(
    (bufferId: string, lineNumbers: number[]) => {
      const buf = getBuffer(bufferId)
      if (!buf?.model) return

      const newDecos: monaco.editor.IModelDeltaDecoration[] = lineNumbers.map((ln) => ({
        range: new monaco.Range(ln, 1, ln, 1),
        options: {
          glyphMarginClassName: 'nmp-bookmark-glyph',
          glyphMarginHoverMessage: { value: 'Bookmark' },
          overviewRuler: {
            color: '#4488FF',
            position: monaco.editor.OverviewRulerLane.Left
          }
        }
      }))

      const existing = _decoIds.get(bufferId) ?? []
      const updated = buf.model.deltaDecorations(existing, newDecos)
      _decoIds.set(bufferId, updated)
    },
    [getBuffer]
  )

  const toggleBookmark = useCallback(
    (bufferId: string, lineNumber: number) => {
      const buf = getBuffer(bufferId)
      if (!buf) return

      const current = buf.bookmarks
      const idx = current.indexOf(lineNumber)
      const updated =
        idx >= 0
          ? current.filter((ln) => ln !== lineNumber)
          : [...current, lineNumber].sort((a, b) => a - b)

      updateBuffer(bufferId, { bookmarks: updated })
      syncDecorations(bufferId, updated)
    },
    [getBuffer, updateBuffer, syncDecorations]
  )

  const nextBookmark = useCallback(
    (bufferId: string, currentLine: number): number | null => {
      const buf = getBuffer(bufferId)
      if (!buf || buf.bookmarks.length === 0) {
        addToast('No bookmarks in this file.', 'info')
        return null
      }
      const sorted = buf.bookmarks
      return sorted.find((ln) => ln > currentLine) ?? sorted[0]
    },
    [getBuffer, addToast]
  )

  const prevBookmark = useCallback(
    (bufferId: string, currentLine: number): number | null => {
      const buf = getBuffer(bufferId)
      if (!buf || buf.bookmarks.length === 0) {
        addToast('No bookmarks in this file.', 'info')
        return null
      }
      const sorted = buf.bookmarks
      return [...sorted].reverse().find((ln) => ln < currentLine) ?? sorted[sorted.length - 1]
    },
    [getBuffer, addToast]
  )

  const clearBookmarks = useCallback(
    (bufferId: string) => {
      updateBuffer(bufferId, { bookmarks: [] })
      syncDecorations(bufferId, [])
    },
    [updateBuffer, syncDecorations]
  )

  // Called after editor.setModel() — decoration IDs become stale on model swap
  const restoreDecorations = useCallback(
    (bufferId: string) => {
      const buf = getBuffer(bufferId)
      if (!buf) return
      _decoIds.delete(bufferId)
      syncDecorations(bufferId, buf.bookmarks)
    },
    [getBuffer, syncDecorations]
  )

  return { toggleBookmark, nextBookmark, prevBookmark, clearBookmarks, restoreDecorations }
}
