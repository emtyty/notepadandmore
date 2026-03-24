import React, { useState, useCallback } from 'react'
import { useUIStore, SearchResult } from '../../store/uiStore'

interface GroupedResults {
  [filePath: string]: SearchResult[]
}

export const FindInFilesResults: React.FC<{ onOpenFile: (filePath: string, line: number) => void }> = ({ onOpenFile }) => {
  const { findResults, showFindResults, setShowFindResults, setFindResults } = useUIStore()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleCollapse = useCallback((filePath: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(filePath)) next.delete(filePath)
      else next.add(filePath)
      return next
    })
  }, [])

  if (!showFindResults || findResults.length === 0) return null

  // Group by file
  const grouped: GroupedResults = {}
  for (const r of findResults) {
    if (!grouped[r.filePath]) grouped[r.filePath] = []
    grouped[r.filePath].push(r)
  }

  const files = Object.keys(grouped)

  return (
    <div style={{
      background: 'var(--panel-bg)',
      borderTop: '1px solid var(--border)',
      maxHeight: 250,
      overflow: 'auto',
      fontSize: 12,
      fontFamily: 'monospace'
    }}>
      <div style={{
        background: 'var(--panel-header-bg)',
        padding: '4px 8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 1
      }}>
        <span>Find Results — {findResults.length} matches in {files.length} files</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setFindResults([]); setShowFindResults(false) }}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}
          >
            Clear
          </button>
          <button
            onClick={() => setShowFindResults(false)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}
          >
            ×
          </button>
        </div>
      </div>
      {files.map((filePath) => {
        const matches = grouped[filePath]
        const isCollapsed = collapsed.has(filePath)
        const shortPath = filePath.split('/').slice(-3).join('/')
        return (
          <div key={filePath}>
            <div
              onClick={() => toggleCollapse(filePath)}
              style={{
                padding: '2px 8px',
                cursor: 'pointer',
                background: 'var(--panel-header-bg)',
                color: 'var(--accent)',
                userSelect: 'none'
              }}
            >
              {isCollapsed ? '▸' : '▾'} {shortPath} ({matches.length})
            </div>
            {!isCollapsed && matches.map((m, i) => (
              <div
                key={i}
                onClick={() => onOpenFile(m.filePath, m.lineNumber)}
                style={{
                  padding: '1px 8px 1px 24px',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--toolbar-btn-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>{m.lineNumber}:</span>
                {m.lineText}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
