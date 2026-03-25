import { useCallback, useRef, useEffect } from 'react'
import * as monaco from 'monaco-editor'
import { editorRegistry } from '../utils/editorRegistry'
import { useSearchStore, SearchOptions, FindResultFile, FindResultSet } from '../store/searchStore'
import { useEditorStore } from '../store/editorStore'
import { useUIStore } from '../store/uiStore'

// ─── Mark decoration colors (5 styles like Notepad++) ────────────────────────
const MARK_COLORS = [
  { bg: 'rgba(255,128,0,0.35)',   ruler: '#FF8000' },
  { bg: 'rgba(0,200,100,0.35)',   ruler: '#00C864' },
  { bg: 'rgba(0,128,255,0.35)',   ruler: '#0080FF' },
  { bg: 'rgba(220,0,220,0.35)',   ruler: '#DC00DC' },
  { bg: 'rgba(255,220,0,0.35)',   ruler: '#FFDC00' },
]

// Mark class names injected into document once
let _stylesInjected = false
function injectMarkStyles(): void {
  if (_stylesInjected) return
  _stylesInjected = true
  const style = document.createElement('style')
  style.textContent = MARK_COLORS.map(
    (c, i) =>
      `.nmp-mark-${i} { background-color: ${c.bg} !important; border-radius: 2px; }`
  ).join('\n') + `
  .nmp-bookmark-glyph::before {
    content: '🔖';
    font-size: 11px;
    line-height: 1;
  }`
  document.head.appendChild(style)
}

// ─── Per-model decoration IDs (keyed by model.id → styleIndex → ids[]) ──────
const _markIds = new Map<string, string[][]>()
const _bookmarkIds = new Map<string, string[]>()

function getMarkIds(modelId: string): string[][] {
  if (!_markIds.has(modelId)) {
    _markIds.set(modelId, [[], [], [], [], []])
  }
  return _markIds.get(modelId)!
}

function getBookmarkIds(modelId: string): string[] {
  if (!_bookmarkIds.has(modelId)) {
    _bookmarkIds.set(modelId, [])
  }
  return _bookmarkIds.get(modelId)!
}

// ─── Extended mode: convert \n \t \x41 \u0041 to actual chars ────────────────
function convertExtended(pattern: string): string {
  return pattern
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\0/g, '\0')
    .replace(/\\x([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Build Monaco-compatible { pattern, isRegex } from SearchOptions */
function buildSearchPattern(opts: SearchOptions): { pattern: string; isRegex: boolean } | null {
  if (!opts.pattern) return null

  if (opts.searchMode === 'regex') {
    return { pattern: opts.pattern, isRegex: true }
  }
  if (opts.searchMode === 'extended') {
    const expanded = convertExtended(opts.pattern)
    return { pattern: escapeRegex(expanded), isRegex: true }
  }
  return { pattern: opts.pattern, isRegex: false }
}

/** Word separator list for Monaco whole-word search */
const WORD_SEPARATORS = '`~!@#$%^&*()-=+[{]}\\|;:\'",.<>/?'

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useSearchEngine() {
  const { options, pushPatternHistory, pushReplaceHistory, setFindResults, setIsSearching } =
    useSearchStore()
  const { buffers } = useEditorStore()
  const { addToast } = useUIStore()

  // Track last-found range so Replace One knows what to replace
  const lastFoundRef = useRef<monaco.Range | null>(null)

  useEffect(() => {
    injectMarkStyles()
  }, [])

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const getEditor = useCallback(() => editorRegistry.get(), [])

  const getModel = useCallback(() => {
    const editor = getEditor()
    return editor?.getModel() ?? null
  }, [getEditor])

  const buildFindOpts = useCallback(
    (opts: SearchOptions) => buildSearchPattern(opts),
    []
  )

  // ── Find Next / Prev ─────────────────────────────────────────────────────────
  const findNext = useCallback(
    (overrideOpts?: Partial<SearchOptions>): monaco.editor.FindMatch | null => {
      const opts = { ...useSearchStore.getState().options, ...overrideOpts }
      const editor = getEditor()
      const model = getModel()
      if (!editor || !model) return null

      const built = buildSearchPattern(opts)
      if (!built) return null

      const pos = editor.getPosition() ?? { lineNumber: 1, column: 1 }
      // Start searching from after current cursor (or selection end)
      const sel = editor.getSelection()
      const startPos = sel
        ? { lineNumber: sel.endLineNumber, column: sel.endColumn }
        : pos

      let match = model.findNextMatch(
        built.pattern,
        startPos,
        built.isRegex,
        opts.isCaseSensitive,
        opts.isWholeWord ? WORD_SEPARATORS : null,
        false
      )

      // Wrap around
      if (!match && opts.isWrapAround) {
        match = model.findNextMatch(
          built.pattern,
          { lineNumber: 1, column: 1 },
          built.isRegex,
          opts.isCaseSensitive,
          opts.isWholeWord ? WORD_SEPARATORS : null,
          false
        )
        if (match) addToast('Reached document end, wrapped around from top.', 'info')
      }

      if (match) {
        lastFoundRef.current = match.range
        editor.setSelection(match.range)
        editor.revealRangeInCenterIfOutsideViewport(match.range)
        editor.focus()
      } else {
        addToast(`"${opts.pattern}" not found.`, 'warn')
        lastFoundRef.current = null
      }

      return match
    },
    [getEditor, getModel, addToast]
  )

  const findPrev = useCallback(
    (overrideOpts?: Partial<SearchOptions>): monaco.editor.FindMatch | null => {
      const opts = { ...useSearchStore.getState().options, ...overrideOpts }
      const editor = getEditor()
      const model = getModel()
      if (!editor || !model) return null

      const built = buildSearchPattern(opts)
      if (!built) return null

      const sel = editor.getSelection()
      const startPos = sel
        ? { lineNumber: sel.startLineNumber, column: sel.startColumn }
        : editor.getPosition() ?? { lineNumber: 1, column: 1 }

      let match = model.findPreviousMatch(
        built.pattern,
        startPos,
        built.isRegex,
        opts.isCaseSensitive,
        opts.isWholeWord ? WORD_SEPARATORS : null,
        false
      )

      if (!match && opts.isWrapAround) {
        const lineCount = model.getLineCount()
        const lastCol = model.getLineMaxColumn(lineCount)
        match = model.findPreviousMatch(
          built.pattern,
          { lineNumber: lineCount, column: lastCol },
          built.isRegex,
          opts.isCaseSensitive,
          opts.isWholeWord ? WORD_SEPARATORS : null,
          false
        )
        if (match) addToast('Reached document start, wrapped around from bottom.', 'info')
      }

      if (match) {
        lastFoundRef.current = match.range
        editor.setSelection(match.range)
        editor.revealRangeInCenterIfOutsideViewport(match.range)
        editor.focus()
      } else {
        addToast(`"${opts.pattern}" not found.`, 'warn')
        lastFoundRef.current = null
      }

      return match
    },
    [getEditor, getModel, addToast]
  )

  // ── Find All (current doc) ────────────────────────────────────────────────────
  const findAllInModel = useCallback(
    (
      targetModel: monaco.editor.ITextModel,
      opts: SearchOptions,
      searchRange?: monaco.IRange
    ): monaco.editor.FindMatch[] => {
      const built = buildSearchPattern(opts)
      if (!built) return []

      return targetModel.findMatches(
        built.pattern,
        searchRange ?? true,
        built.isRegex,
        opts.isCaseSensitive,
        opts.isWholeWord ? WORD_SEPARATORS : null,
        false
      )
    },
    []
  )

  const findAll = useCallback(
    (overrideOpts?: Partial<SearchOptions>) => {
      const opts = { ...useSearchStore.getState().options, ...overrideOpts }
      const editor = getEditor()
      const model = getModel()
      if (!editor || !model) return

      if (!opts.pattern) return

      // When inSelection, limit to current selection
      let searchRange: monaco.IRange | undefined
      if (opts.inSelection) {
        const sel = editor.getSelection()
        if (sel) searchRange = sel
      }

      const matches = findAllInModel(model, opts, searchRange)
      pushPatternHistory(opts.pattern)

      // Build results for FindResultsPanel
      const { buffers, activeId } = useEditorStore.getState()
      const activeBuf = buffers.find((b) => b.id === activeId)
      const fileResults: FindResultFile[] = []

      if (matches.length > 0) {
        fileResults.push({
          filePath: activeBuf?.filePath ?? null,
          title: activeBuf?.title ?? 'untitled',
          bufferId: activeId ?? undefined,
          results: matches.map((m) => ({
            lineNumber: m.range.startLineNumber,
            column: m.range.startColumn,
            endColumn: m.range.endColumn,
            lineText: model.getLineContent(m.range.startLineNumber),
            matchText: model.getValueInRange(m.range)
          }))
        })
      }

      const resultSet: FindResultSet = {
        query: opts.pattern,
        scope: 'currentDoc',
        totalHits: matches.length,
        files: fileResults
      }

      setFindResults(resultSet)
      useUIStore.getState().setShowBottomPanel(true)
      useUIStore.getState().setActiveBottomPanel('findResults')

      addToast(`Found ${matches.length} match${matches.length !== 1 ? 'es' : ''}.`, 'info')
    },
    [getEditor, getModel, findAllInModel, pushPatternHistory, setFindResults, addToast]
  )

  // ── Find All in All Open Docs ────────────────────────────────────────────────
  const findAllInOpenDocs = useCallback(
    (overrideOpts?: Partial<SearchOptions>) => {
      const opts = { ...useSearchStore.getState().options, ...overrideOpts }
      if (!opts.pattern) return

      const { buffers } = useEditorStore.getState()
      const fileResults: FindResultFile[] = []
      let totalHits = 0

      for (const buf of buffers) {
        if (!buf.model) continue
        const matches = findAllInModel(buf.model, opts)
        if (matches.length === 0) continue

        totalHits += matches.length
        fileResults.push({
          filePath: buf.filePath,
          title: buf.title,
          bufferId: buf.id,
          results: matches.map((m) => ({
            lineNumber: m.range.startLineNumber,
            column: m.range.startColumn,
            endColumn: m.range.endColumn,
            lineText: buf.model!.getLineContent(m.range.startLineNumber),
            matchText: buf.model!.getValueInRange(m.range)
          }))
        })
      }

      pushPatternHistory(opts.pattern)
      setFindResults({ query: opts.pattern, scope: 'allOpenDocs', totalHits, files: fileResults })
      useUIStore.getState().setShowBottomPanel(true)
      useUIStore.getState().setActiveBottomPanel('findResults')
      addToast(`Found ${totalHits} match${totalHits !== 1 ? 'es' : ''} in ${fileResults.length} file${fileResults.length !== 1 ? 's' : ''}.`, 'info')
    },
    [findAllInModel, pushPatternHistory, setFindResults, addToast]
  )

  // ── Count ────────────────────────────────────────────────────────────────────
  const countAll = useCallback(
    (overrideOpts?: Partial<SearchOptions>): number => {
      const opts = { ...useSearchStore.getState().options, ...overrideOpts }
      const model = getModel()
      if (!model || !opts.pattern) return 0

      const matches = findAllInModel(model, opts)
      addToast(`Count: ${matches.length} match${matches.length !== 1 ? 'es' : ''}.`, 'info')
      return matches.length
    },
    [getModel, findAllInModel, addToast]
  )

  // ── Replace One ────────────────────────────────────────────────────────────
  const replaceOne = useCallback(
    (overrideOpts?: Partial<SearchOptions>) => {
      const opts = { ...useSearchStore.getState().options, ...overrideOpts }
      const editor = getEditor()
      const model = getModel()
      if (!editor || !model || !opts.pattern) return

      const built = buildSearchPattern(opts)
      if (!built) return

      // If there's a currently selected match, replace it
      const sel = editor.getSelection()
      let rangeToReplace: monaco.Range | null = null

      if (sel && !sel.isEmpty()) {
        const selText = model.getValueInRange(sel)
        // Verify it actually matches
        const testMatches = model.findMatches(
          built.pattern,
          sel,
          built.isRegex,
          opts.isCaseSensitive,
          opts.isWholeWord ? WORD_SEPARATORS : null,
          false,
          1
        )
        if (testMatches.length > 0 && testMatches[0].range.equalsRange(sel)) {
          rangeToReplace = monaco.Range.lift(sel)
        }
      }

      // If nothing to replace, find next first
      if (!rangeToReplace) {
        const match = findNext(overrideOpts)
        if (match) rangeToReplace = match.range
        else return
      }

      if (rangeToReplace) {
        let replacement = opts.replaceText
        if (built.isRegex && opts.searchMode === 'regex') {
          // Capture group substitution via JS regex
          try {
            const flags = opts.isCaseSensitive ? '' : 'i'
            const re = new RegExp(opts.pattern, flags)
            const matchedText = model.getValueInRange(rangeToReplace)
            replacement = matchedText.replace(re, opts.replaceText)
          } catch {
            // fallback to literal replace text
          }
        }

        editor.executeEdits('find-replace', [{
          range: rangeToReplace,
          text: replacement
        }])

        pushPatternHistory(opts.pattern)
        pushReplaceHistory(opts.replaceText)

        // Move to next match
        findNext(overrideOpts)
      }
    },
    [getEditor, getModel, findNext, pushPatternHistory, pushReplaceHistory]
  )

  // ── Replace All ────────────────────────────────────────────────────────────
  const replaceAll = useCallback(
    (overrideOpts?: Partial<SearchOptions>): number => {
      const opts = { ...useSearchStore.getState().options, ...overrideOpts }
      const editor = getEditor()
      const model = getModel()
      if (!editor || !model || !opts.pattern) return 0

      const built = buildSearchPattern(opts)
      if (!built) return 0

      let searchRange: monaco.IRange | undefined
      if (opts.inSelection) {
        const sel = editor.getSelection()
        if (sel) searchRange = sel
      }

      const matches = findAllInModel(model, opts, searchRange)
      if (matches.length === 0) {
        addToast(`"${opts.pattern}" not found.`, 'warn')
        return 0
      }

      const edits: monaco.editor.IIdentifiedSingleEditOperation[] = matches.map((m) => {
        let replacement = opts.replaceText
        if (built.isRegex && opts.searchMode === 'regex') {
          try {
            const flags = opts.isCaseSensitive ? '' : 'i'
            const re = new RegExp(opts.pattern, flags)
            const matchedText = model.getValueInRange(m.range)
            replacement = matchedText.replace(re, opts.replaceText)
          } catch {
            // keep literal
          }
        }
        return { range: m.range, text: replacement }
      })

      editor.executeEdits('find-replace-all', edits)
      pushPatternHistory(opts.pattern)
      pushReplaceHistory(opts.replaceText)
      addToast(`Replaced ${matches.length} match${matches.length !== 1 ? 'es' : ''}.`, 'info')

      return matches.length
    },
    [getEditor, getModel, findAllInModel, pushPatternHistory, pushReplaceHistory, addToast]
  )

  // ── Mark All ───────────────────────────────────────────────────────────────
  const markAll = useCallback(
    (styleIndex: number, overrideOpts?: Partial<SearchOptions>) => {
      const opts = { ...useSearchStore.getState().options, ...overrideOpts }
      const model = getModel()
      if (!model || !opts.pattern) return

      const matches = findAllInModel(model, opts)
      if (matches.length === 0) {
        addToast(`"${opts.pattern}" not found.`, 'warn')
        return
      }

      const ids = getMarkIds(model.id)
      const newDecorations: monaco.editor.IModelDeltaDecoration[] = matches.map((m) => ({
        range: m.range,
        options: {
          inlineClassName: `nmp-mark-${styleIndex}`,
          overviewRuler: {
            color: MARK_COLORS[styleIndex].ruler,
            position: monaco.editor.OverviewRulerLane.Center
          },
          minimap: { color: MARK_COLORS[styleIndex].ruler, position: monaco.editor.MinimapPosition.Inline }
        }
      }))

      ids[styleIndex] = model.deltaDecorations(ids[styleIndex], newDecorations)
      pushPatternHistory(opts.pattern)
      addToast(`Marked ${matches.length} match${matches.length !== 1 ? 'es' : ''}.`, 'info')
    },
    [getModel, findAllInModel, pushPatternHistory, addToast]
  )

  const clearMarks = useCallback(
    (styleIndex?: number) => {
      const model = getModel()
      if (!model) return

      const ids = getMarkIds(model.id)
      if (styleIndex !== undefined) {
        ids[styleIndex] = model.deltaDecorations(ids[styleIndex], [])
      } else {
        for (let i = 0; i < 5; i++) {
          ids[i] = model.deltaDecorations(ids[i], [])
        }
      }
    },
    [getModel]
  )

  // ── Bookmark matched lines ─────────────────────────────────────────────────
  const bookmarkLines = useCallback(
    (overrideOpts?: Partial<SearchOptions>) => {
      const opts = { ...useSearchStore.getState().options, ...overrideOpts }
      const model = getModel()
      if (!model || !opts.pattern) return

      const matches = findAllInModel(model, opts)
      if (matches.length === 0) {
        addToast(`"${opts.pattern}" not found.`, 'warn')
        return
      }

      // Unique lines only
      const seenLines = new Set<number>()
      const newDecorations: monaco.editor.IModelDeltaDecoration[] = []
      for (const m of matches) {
        if (!seenLines.has(m.range.startLineNumber)) {
          seenLines.add(m.range.startLineNumber)
          newDecorations.push({
            range: new monaco.Range(m.range.startLineNumber, 1, m.range.startLineNumber, 1),
            options: {
              glyphMarginClassName: 'nmp-bookmark-glyph',
              overviewRuler: { color: '#4488FF', position: monaco.editor.OverviewRulerLane.Left }
            }
          })
        }
      }

      const bookmarkIdsForModel = getBookmarkIds(model.id)
      const updated = model.deltaDecorations(bookmarkIdsForModel, newDecorations)
      _bookmarkIds.set(model.id, updated)

      addToast(`Bookmarked ${seenLines.size} line${seenLines.size !== 1 ? 's' : ''}.`, 'info')
    },
    [getModel, findAllInModel, addToast]
  )

  // ── Find in Files (main process IPC) ─────────────────────────────────────
  const findInFiles = useCallback(
    async (directory: string, fileFilter: string, isRecursive: boolean, overrideOpts?: Partial<SearchOptions>) => {
      const opts = { ...useSearchStore.getState().options, ...overrideOpts }
      if (!opts.pattern || !directory) return

      const built = buildSearchPattern(opts)
      if (!built) return

      setIsSearching(true)
      pushPatternHistory(opts.pattern)

      try {
        const result = await (window.api as any).search.findInFiles({
          pattern: built.pattern,
          isRegex: built.isRegex,
          isCaseSensitive: opts.isCaseSensitive,
          isWholeWord: opts.isWholeWord,
          directory,
          fileFilter,
          isRecursive
        })

        const resultSet: FindResultSet = {
          query: opts.pattern,
          scope: `directory:${directory}`,
          totalHits: result.totalHits,
          files: result.files
        }

        setFindResults(resultSet)
        useUIStore.getState().setShowBottomPanel(true)
        useUIStore.getState().setActiveBottomPanel('findResults')
        addToast(`Found ${result.totalHits} match${result.totalHits !== 1 ? 'es' : ''} in ${result.files.length} file${result.files.length !== 1 ? 's' : ''}.`, 'info')
      } catch (err) {
        addToast('Find in Files failed.', 'error')
      } finally {
        setIsSearching(false)
      }
    },
    [pushPatternHistory, setFindResults, setIsSearching, addToast]
  )

  return {
    findNext,
    findPrev,
    findAll,
    findAllInOpenDocs,
    countAll,
    replaceOne,
    replaceAll,
    markAll,
    clearMarks,
    bookmarkLines,
    findInFiles
  }
}
