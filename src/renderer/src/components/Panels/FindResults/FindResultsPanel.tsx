import React, { useState, useCallback, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useSearchStore, FindResultLine, FindResultFile } from '../../../store/searchStore'
import { useEditorStore } from '../../../store/editorStore'
import { useFileOps } from '../../../hooks/useFileOps'
import { editorRegistry } from '../../../utils/editorRegistry'
import * as monaco from 'monaco-editor'
import styles from './FindResultsPanel.module.css'

// ─── Row types for flat virtual list ─────────────────────────────────────────
type Row =
  | { kind: 'file-header'; file: FindResultFile; hitCount: number; fileIndex: number }
  | { kind: 'result-line'; file: FindResultFile; result: FindResultLine }

const ROW_HEIGHT_HEADER = 28
const ROW_HEIGHT_LINE = 22

// ─── Highlight match text within a line ──────────────────────────────────────
function HighlightedLine({
  lineText,
  column,
  endColumn
}: {
  lineText: string
  column: number
  endColumn: number
}) {
  const before = lineText.slice(0, column - 1)
  const match = lineText.slice(column - 1, endColumn - 1)
  const after = lineText.slice(endColumn - 1)

  const MAX = 200
  const trimmed = lineText.length > MAX
  const displayBefore = trimmed ? before.slice(-60) : before
  const displayAfter = trimmed ? after.slice(0, 60) : after

  return (
    <span className={styles.lineText}>
      {trimmed && before.length > 60 && <span style={{ color: 'var(--text-muted)' }}>…</span>}
      {displayBefore}
      <span className={styles.matchHighlight}>{match}</span>
      {displayAfter}
      {trimmed && after.length > 60 && <span style={{ color: 'var(--text-muted)' }}>…</span>}
    </span>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export function FindResultsPanel() {
  const { findResults, isSearching, searchProgress } = useSearchStore()
  const { buffers, setActive } = useEditorStore()
  const { openFiles } = useFileOps()

  // Track collapsed file groups by filePath (or title as fallback)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleCollapse = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // Flatten files + result lines into a single Row array for the virtualizer
  const rows = useMemo<Row[]>(() => {
    if (!findResults) return []
    const out: Row[] = []
    for (let i = 0; i < findResults.files.length; i++) {
      const file = findResults.files[i]
      const key = file.filePath ?? file.title
      out.push({ kind: 'file-header', file, hitCount: file.results.length, fileIndex: i })
      if (!collapsed.has(key)) {
        for (const result of file.results) {
          out.push({ kind: 'result-line', file, result })
        }
      }
    }
    return out
  }, [findResults, collapsed])

  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => rows[i].kind === 'file-header' ? ROW_HEIGHT_HEADER : ROW_HEIGHT_LINE,
    overscan: 10,
  })

  const handleNavigate = useCallback(
    async (file: FindResultFile, lineNumber: number, column: number) => {
      if (file.bufferId) {
        setActive(file.bufferId)
      } else if (file.filePath) {
        const existing = buffers.find((b) => b.filePath === file.filePath)
        if (existing) {
          setActive(existing.id)
        } else {
          await openFiles([file.filePath])
        }
      }

      setTimeout(() => {
        const editor = editorRegistry.get()
        if (!editor) return
        const range = new monaco.Range(lineNumber, column, lineNumber, column)
        editor.setPosition({ lineNumber, column })
        editor.revealLineInCenter(lineNumber)
        editor.setSelection(range)
        editor.focus()
      }, 50)
    },
    [buffers, setActive, openFiles]
  )

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {findResults && (
            <span className={styles.summary}>
              "{findResults.query}" — {findResults.totalHits} hit{findResults.totalHits !== 1 ? 's' : ''} in{' '}
              {findResults.files.length} file{findResults.files.length !== 1 ? 's' : ''} · {findResults.scope}
              {findResults.searchDurationMs != null && !isSearching && (
                <>
                  {' '}
                  <span className={styles.meta}>
                    · {findResults.searchEngineLabel ?? 'Search'}{' '}
                    {findResults.searchDurationMs >= 1000
                      ? `${(findResults.searchDurationMs / 1000).toFixed(2)}s`
                      : `${findResults.searchDurationMs}ms`}
                  </span>
                </>
              )}
            </span>
          )}
          {isSearching && searchProgress && (
            <span className={styles.progressBadge}>
              {searchProgress.scanned > 0
                ? `Scanning ${searchProgress.scanned} files…`
                : 'Collecting files…'}
            </span>
          )}
        </div>
      </div>

      <div className={styles.body} ref={parentRef}>
        {!findResults || findResults.files.length === 0 ? (
          <div className={styles.empty}>{isSearching ? 'Searching…' : 'No results.'}</div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vItem) => {
              const row = rows[vItem.index]

              if (row.kind === 'file-header') {
                const key = row.file.filePath ?? row.file.title
                const isCollapsed = collapsed.has(key)
                return (
                  <div
                    key={vItem.key}
                    style={{ position: 'absolute', top: vItem.start, left: 0, right: 0, height: ROW_HEIGHT_HEADER }}
                    className={styles.fileHeader}
                    onClick={() => toggleCollapse(key)}
                    title={row.file.filePath ?? row.file.title}
                  >
                    <span className={styles.toggle}>{isCollapsed ? '▶' : '▼'}</span>
                    <span className={styles.filePath}>{row.file.filePath ?? row.file.title}</span>
                    <span className={styles.fileCount}>
                      ({row.hitCount} hit{row.hitCount !== 1 ? 's' : ''})
                    </span>
                  </div>
                )
              }

              // result-line
              return (
                <div
                  key={vItem.key}
                  style={{ position: 'absolute', top: vItem.start, left: 0, right: 0, height: ROW_HEIGHT_LINE }}
                  className={styles.resultLine}
                  onClick={() => handleNavigate(row.file, row.result.lineNumber, row.result.column)}
                  title={`${row.file.filePath ?? row.file.title}:${row.result.lineNumber}:${row.result.column}`}
                >
                  <span className={styles.lineNum}>{row.result.lineNumber}</span>
                  <HighlightedLine
                    lineText={row.result.lineText}
                    column={row.result.column}
                    endColumn={row.result.endColumn}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
