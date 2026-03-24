import { useState, useCallback, useRef } from 'react'
import * as monaco from 'monaco-editor'

interface FindOptions {
  matchCase: boolean
  wholeWord: boolean
  isRegex: boolean
  wrapAround: boolean
}

interface FindState {
  matches: monaco.editor.FindMatch[]
  currentIndex: number
  totalCount: number
}

export function useFindReplace(
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>
) {
  const [state, setState] = useState<FindState>({ matches: [], currentIndex: -1, totalCount: 0 })
  const decorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null)
  const currentDecRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null)
  const lastSearchRef = useRef<string>('')
  const lastOptionsRef = useRef<FindOptions>({ matchCase: false, wholeWord: false, isRegex: false, wrapAround: true })

  const clearDecorations = useCallback(() => {
    decorationsRef.current?.set([])
    currentDecRef.current?.set([])
  }, [])

  const findAll = useCallback((searchText: string, options: FindOptions): monaco.editor.FindMatch[] => {
    const editor = editorRef.current
    if (!editor || !searchText) {
      clearDecorations()
      setState({ matches: [], currentIndex: -1, totalCount: 0 })
      return []
    }

    const model = editor.getModel()
    if (!model) return []

    lastSearchRef.current = searchText
    lastOptionsRef.current = options

    const matches = model.findMatches(
      searchText,
      true, // searchOnlyEditableRange = false (search all)
      options.isRegex,
      options.matchCase,
      options.wholeWord ? 'true' : null,
      false // captureMatches
    )

    // Highlight all matches
    const allDecorations = matches.map((m) => ({
      range: m.range,
      options: { className: 'find-highlight', stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges }
    }))

    if (decorationsRef.current) {
      decorationsRef.current.set(allDecorations)
    } else if (editor) {
      decorationsRef.current = editor.createDecorationsCollection(allDecorations)
    }

    const idx = matches.length > 0 ? 0 : -1
    setState({ matches, currentIndex: idx, totalCount: matches.length })

    if (matches.length > 0) {
      selectMatch(editor, matches[0], currentDecRef)
    }

    return matches
  }, [editorRef, clearDecorations])

  const findNext = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return

    setState((prev) => {
      if (prev.matches.length === 0) return prev
      let nextIdx = prev.currentIndex + 1
      if (nextIdx >= prev.matches.length) {
        if (!lastOptionsRef.current.wrapAround) return prev
        nextIdx = 0
      }
      selectMatch(editor, prev.matches[nextIdx], currentDecRef)
      return { ...prev, currentIndex: nextIdx }
    })
  }, [editorRef])

  const findPrev = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return

    setState((prev) => {
      if (prev.matches.length === 0) return prev
      let prevIdx = prev.currentIndex - 1
      if (prevIdx < 0) {
        if (!lastOptionsRef.current.wrapAround) return prev
        prevIdx = prev.matches.length - 1
      }
      selectMatch(editor, prev.matches[prevIdx], currentDecRef)
      return { ...prev, currentIndex: prevIdx }
    })
  }, [editorRef])

  const replaceCurrent = useCallback((replaceText: string) => {
    const editor = editorRef.current
    if (!editor) return

    const currentState = state
    if (currentState.currentIndex < 0 || currentState.matches.length === 0) return

    const match = currentState.matches[currentState.currentIndex]
    const selection = editor.getSelection()

    // Only replace if current selection matches the found range
    if (selection && match.range.equalsRange(selection)) {
      editor.executeEdits('find-replace', [{
        range: match.range,
        text: replaceText,
        forceMoveMarkers: true
      }])
      // Re-search and find next
      const newMatches = findAll(lastSearchRef.current, lastOptionsRef.current)
      if (newMatches.length > 0) {
        // Adjust index: find the next match at or after the replacement position
        const pos = match.range.getStartPosition()
        let idx = newMatches.findIndex((m) =>
          m.range.getStartPosition().isBeforeOrEqual(pos) === false ||
          (m.range.startLineNumber === pos.lineNumber && m.range.startColumn >= pos.column)
        )
        if (idx < 0) idx = 0
        setState((prev) => ({ ...prev, currentIndex: idx }))
        selectMatch(editor, newMatches[idx], currentDecRef)
      }
    } else {
      // Selection doesn't match — just find next
      findNext()
    }
  }, [editorRef, state, findAll, findNext])

  const replaceAll = useCallback((searchText: string, replaceText: string, options: FindOptions) => {
    const editor = editorRef.current
    if (!editor || !searchText) return 0

    const model = editor.getModel()
    if (!model) return 0

    const matches = model.findMatches(
      searchText, true, options.isRegex, options.matchCase,
      options.wholeWord ? 'true' : null, false
    )

    if (matches.length === 0) return 0

    // Single edit operation = single undo point
    const edits = matches.reverse().map((m) => ({
      range: m.range,
      text: replaceText,
      forceMoveMarkers: true
    }))

    editor.executeEdits('find-replace-all', edits)
    clearDecorations()
    setState({ matches: [], currentIndex: -1, totalCount: 0 })

    return matches.length
  }, [editorRef, clearDecorations])

  const close = useCallback(() => {
    clearDecorations()
    setState({ matches: [], currentIndex: -1, totalCount: 0 })
    editorRef.current?.focus()
  }, [editorRef, clearDecorations])

  return {
    ...state,
    findAll,
    findNext,
    findPrev,
    replaceCurrent,
    replaceAll,
    close
  }
}

function selectMatch(
  editor: monaco.editor.IStandaloneCodeEditor,
  match: monaco.editor.FindMatch,
  currentDecRef: React.MutableRefObject<monaco.editor.IEditorDecorationsCollection | null>
) {
  editor.setSelection(match.range)
  editor.revealRangeInCenter(match.range)

  const dec = [{
    range: match.range,
    options: { className: 'find-highlight-current', stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges }
  }]

  if (currentDecRef.current) {
    currentDecRef.current.set(dec)
  } else {
    currentDecRef.current = editor.createDecorationsCollection(dec)
  }
}
