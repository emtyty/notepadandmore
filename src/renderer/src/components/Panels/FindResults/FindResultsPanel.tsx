import React, { useState, useCallback } from 'react'
import { useSearchStore, FindResultLine, FindResultFile } from '../../../store/searchStore'
import { useEditorStore } from '../../../store/editorStore'
import { useFileOps } from '../../../hooks/useFileOps'
import { editorRegistry } from '../../../utils/editorRegistry'
import * as monaco from 'monaco-editor'
import styles from './FindResultsPanel.module.css'

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

  // Trim very long lines
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

// ─── Single result line ───────────────────────────────────────────────────────
function ResultLineItem({
  result,
  file,
  onNavigate
}: {
  result: FindResultLine
  file: FindResultFile
  onNavigate: (file: FindResultFile, line: number, col: number) => void
}) {
  return (
    <div
      className={styles.resultLine}
      onClick={() => onNavigate(file, result.lineNumber, result.column)}
      title={`${file.filePath ?? file.title}:${result.lineNumber}:${result.column}`}
    >
      <span className={styles.lineNum}>{result.lineNumber}</span>
      <HighlightedLine
        lineText={result.lineText}
        column={result.column}
        endColumn={result.endColumn}
      />
    </div>
  )
}

// ─── File group ───────────────────────────────────────────────────────────────
function FileGroup({
  file,
  onNavigate
}: {
  file: FindResultFile
  onNavigate: (file: FindResultFile, line: number, col: number) => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={styles.fileGroup}>
      <div className={styles.fileHeader} onClick={() => setCollapsed((v) => !v)}>
        <span className={styles.toggle}>{collapsed ? '▶' : '▼'}</span>
        <span className={styles.filePath} title={file.filePath ?? file.title}>
          {file.filePath ?? file.title}
        </span>
        <span className={styles.fileCount}>
          ({file.results.length} hit{file.results.length !== 1 ? 's' : ''})
        </span>
      </div>
      {!collapsed && file.results.map((r, i) => (
        <ResultLineItem key={i} result={r} file={file} onNavigate={onNavigate} />
      ))}
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export function FindResultsPanel() {
  const { findResults, isSearching, searchProgress } = useSearchStore()
  const { buffers, setActive } = useEditorStore()
  const { openFiles } = useFileOps()

  const handleNavigate = useCallback(
    async (file: FindResultFile, lineNumber: number, column: number) => {
      // If there's a bufferId, switch to that buffer
      if (file.bufferId) {
        setActive(file.bufferId)
      } else if (file.filePath) {
        // Open the file
        const existing = buffers.find((b) => b.filePath === file.filePath)
        if (existing) {
          setActive(existing.id)
        } else {
          await openFiles([file.filePath])
        }
      }

      // Navigate to the line/column in the editor
      // Use a small delay to let the model swap complete
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

      <div className={styles.body}>
        {!findResults || findResults.files.length === 0 ? (
          <div className={styles.empty}>{isSearching ? 'Searching…' : 'No results.'}</div>
        ) : (
          findResults.files.map((file, i) => (
            <FileGroup key={i} file={file} onNavigate={handleNavigate} />
          ))
        )}
      </div>
    </div>
  )
}
