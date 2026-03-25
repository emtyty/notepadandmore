import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useUIStore } from '../../../store/uiStore'
import { useSearchStore, SearchMode } from '../../../store/searchStore'
import { useSearchEngine } from '../../../hooks/useSearchEngine'
import styles from './FindReplaceDialog.module.css'

type DialogTab = 'find' | 'replace' | 'findInFiles' | 'mark'

const MARK_COLORS_CSS = ['#FF8000', '#00C864', '#0080FF', '#DC00DC', '#FFDC00']

// ─── History dropdown ────────────────────────────────────────────────────────
interface HistoryDropdownProps {
  items: string[]
  onSelect: (v: string) => void
  onClose: () => void
}
function HistoryDropdown({ items, onSelect, onClose }: HistoryDropdownProps) {
  if (items.length === 0) return null
  return (
    <div className={styles.historyDropdown}>
      {items.map((item, i) => (
        <div
          key={i}
          className={styles.historyItem}
          onMouseDown={(e) => { e.preventDefault(); onSelect(item); onClose() }}
          title={item}
        >
          {item}
        </div>
      ))}
    </div>
  )
}

// ─── Search input with history ───────────────────────────────────────────────
interface SearchInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  history: string[]
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  autoFocus?: boolean
  inputRef?: React.RefObject<HTMLInputElement>
}
function SearchInput({ value, onChange, placeholder, history, onKeyDown, autoFocus, inputRef }: SearchInputProps) {
  const [showHistory, setShowHistory] = useState(false)

  return (
    <div className={styles.inputWrapper}>
      <input
        ref={inputRef}
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        onFocus={() => history.length > 0 && setShowHistory(false)}
        style={{ paddingRight: 24 }}
        spellCheck={false}
      />
      <button
        className={styles.historyBtn}
        tabIndex={-1}
        onMouseDown={(e) => { e.preventDefault(); setShowHistory((v) => !v) }}
        title="Recent searches"
      >
        ▾
      </button>
      {showHistory && (
        <HistoryDropdown
          items={history}
          onSelect={onChange}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  )
}

// ─── Shared options panel ─────────────────────────────────────────────────────
interface SearchOptionsProps {
  showInSelection?: boolean
}
function SearchOptionsPanel({ showInSelection }: SearchOptionsProps) {
  const { options, setOptions } = useSearchStore()
  return (
    <>
      <div className={styles.modeRow}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>Mode:</span>
        {(['normal', 'extended', 'regex'] as SearchMode[]).map((m) => (
          <label key={m} className={styles.radioLabel}>
            <input
              type="radio"
              name="searchMode"
              value={m}
              checked={options.searchMode === m}
              onChange={() => setOptions({ searchMode: m })}
            />
            {m === 'normal' ? 'Normal' : m === 'extended' ? 'Extended (\\n \\t …)' : 'Regex'}
          </label>
        ))}
      </div>
      <div className={styles.optionsRow}>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={options.isCaseSensitive}
            onChange={(e) => setOptions({ isCaseSensitive: e.target.checked })}
          />
          Match case
        </label>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={options.isWholeWord}
            onChange={(e) => setOptions({ isWholeWord: e.target.checked })}
          />
          Whole word
        </label>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={options.isWrapAround}
            onChange={(e) => setOptions({ isWrapAround: e.target.checked })}
          />
          Wrap around
        </label>
        {options.searchMode === 'regex' && (
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={options.dotMatchesNewline}
              onChange={(e) => setOptions({ dotMatchesNewline: e.target.checked })}
            />
            . matches newline
          </label>
        )}
        {showInSelection && (
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={options.inSelection}
              onChange={(e) => setOptions({ inSelection: e.target.checked })}
            />
            In selection
          </label>
        )}
      </div>
    </>
  )
}

// ─── Main dialog ──────────────────────────────────────────────────────────────
export function FindReplaceDialog() {
  const { showFindReplace, findReplaceMode, closeFind } = useUIStore()
  const { options, setOptions, patternHistory, replaceHistory, markStyleIndex, setMarkStyleIndex, isSearching } =
    useSearchStore()
  const engine = useSearchEngine()

  // Dialog tab — sync with findReplaceMode on open
  const [activeTab, setActiveTab] = useState<DialogTab>('find')
  useEffect(() => {
    if (showFindReplace) {
      setActiveTab(findReplaceMode as DialogTab)
    }
  }, [showFindReplace, findReplaceMode])

  // Dragging — null means "use CSS centering"
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ dragging: false, sx: 0, sy: 0, ox: 0, oy: 0 })

  // Reset to centered position every time dialog opens
  useEffect(() => {
    if (showFindReplace) setPos(null)
  }, [showFindReplace])

  const onTitleMouseDown = useCallback((e: React.MouseEvent) => {
    // Capture actual pixel position before first drag
    const rect = dialogRef.current?.getBoundingClientRect()
    const ox = rect ? rect.left : pos?.x ?? 0
    const oy = rect ? rect.top : pos?.y ?? 0
    dragRef.current = { dragging: true, sx: e.clientX, sy: e.clientY, ox, oy }
    setPos({ x: ox, y: oy })
    e.preventDefault()
  }, [pos])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current.dragging) return
      setPos({
        x: dragRef.current.ox + e.clientX - dragRef.current.sx,
        y: dragRef.current.oy + e.clientY - dragRef.current.sy
      })
    }
    const onUp = () => { dragRef.current.dragging = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  // Escape key → close
  useEffect(() => {
    if (!showFindReplace) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeFind()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showFindReplace, closeFind])

  // Status message
  const [status, setStatus] = useState<{ msg: string; type: 'ok' | 'warn' | 'none' }>({ msg: '', type: 'none' })

  // Find in Files state
  const [fifDir, setFifDir] = useState('')
  const [fifFilter, setFifFilter] = useState('*.*')
  const [fifRecursive, setFifRecursive] = useState(true)

  const findInputRef = useRef<HTMLInputElement>(null)

  // Auto-focus pattern input on open
  useEffect(() => {
    if (showFindReplace) {
      setTimeout(() => findInputRef.current?.focus(), 50)
    }
  }, [showFindReplace])

  if (!showFindReplace) return null

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFindNext = () => {
    const m = engine.findNext()
    setStatus(m ? { msg: '', type: 'none' } : { msg: `"${options.pattern}" not found.`, type: 'warn' })
  }

  const handleFindPrev = () => {
    const m = engine.findPrev()
    setStatus(m ? { msg: '', type: 'none' } : { msg: `"${options.pattern}" not found.`, type: 'warn' })
  }

  const handleCount = () => {
    const n = engine.countAll()
    setStatus({ msg: `${n} match${n !== 1 ? 'es' : ''} found.`, type: n > 0 ? 'ok' : 'warn' })
  }

  const handleFindAll = () => {
    engine.findAll()
    setStatus({ msg: 'Results shown in Find Results panel.', type: 'ok' })
  }

  const handleFindAllOpenDocs = () => {
    engine.findAllInOpenDocs()
    setStatus({ msg: 'Results shown in Find Results panel.', type: 'ok' })
  }

  const handleReplaceOne = () => {
    engine.replaceOne()
  }

  const handleReplaceAll = () => {
    const n = engine.replaceAll()
    setStatus({ msg: n > 0 ? `Replaced ${n} match${n !== 1 ? 'es' : ''}.` : `"${options.pattern}" not found.`, type: n > 0 ? 'ok' : 'warn' })
  }

  const handleMarkAll = () => {
    engine.markAll(markStyleIndex)
  }

  const handleClearMarks = () => {
    engine.clearMarks(markStyleIndex)
    setStatus({ msg: 'Marks cleared.', type: 'none' })
  }

  const handleClearAllMarks = () => {
    engine.clearMarks()
    setStatus({ msg: 'All marks cleared.', type: 'none' })
  }

  const handleBookmark = () => {
    engine.bookmarkLines()
  }

  const handleFindInFiles = async () => {
    if (!fifDir) {
      setStatus({ msg: 'Please select a directory.', type: 'warn' })
      return
    }
    await engine.findInFiles(fifDir, fifFilter, fifRecursive)
    setStatus({ msg: 'Search complete. See Find Results panel.', type: 'ok' })
  }

  const handleBrowseDir = async () => {
    // Use Electron open dialog
    const result = await (window.api as any).file.openDirDialog?.()
    if (result?.filePath) setFifDir(result.filePath)
  }

  const findInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.shiftKey ? handleFindPrev() : handleFindNext()
    }
  }

  const replaceInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleReplaceOne()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.overlay}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        style={pos ? { left: pos.x, top: pos.y } : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
      >
        {/* Title bar */}
        <div className={styles.titleBar} onMouseDown={onTitleMouseDown}>
          <span className={styles.titleText}>Find & Replace</span>
          <button className={styles.closeBtn} onClick={closeFind} tabIndex={-1} title="Close (Esc)">✕</button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {(['find', 'replace', 'findInFiles', 'mark'] as DialogTab[]).map((tab) => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'find' ? 'Find' : tab === 'replace' ? 'Replace' : tab === 'findInFiles' ? 'Find in Files' : 'Mark'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className={styles.content}>

          {/* ── Find Tab ── */}
          {activeTab === 'find' && (
            <>
              <div className={styles.row}>
                <span className={styles.label}>Find:</span>
                <SearchInput
                  value={options.pattern}
                  onChange={(v) => setOptions({ pattern: v })}
                  placeholder="Search pattern…"
                  history={patternHistory}
                  onKeyDown={findInputKeyDown}
                  autoFocus
                  inputRef={findInputRef}
                />
              </div>
              <SearchOptionsPanel showInSelection />
              <hr className={styles.divider} />
              <div className={styles.btnRow}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleFindNext}>Find Next ↓</button>
                <button className={styles.btn} onClick={handleFindPrev}>Find Prev ↑</button>
                <button className={styles.btn} onClick={handleCount}>Count</button>
                <button className={styles.btn} onClick={handleFindAll}>Find All (this doc)</button>
                <button className={styles.btn} onClick={handleFindAllOpenDocs}>Find All (open docs)</button>
              </div>
            </>
          )}

          {/* ── Replace Tab ── */}
          {activeTab === 'replace' && (
            <>
              <div className={styles.row}>
                <span className={styles.label}>Find:</span>
                <SearchInput
                  value={options.pattern}
                  onChange={(v) => setOptions({ pattern: v })}
                  placeholder="Search pattern…"
                  history={patternHistory}
                  onKeyDown={findInputKeyDown}
                  autoFocus
                  inputRef={findInputRef}
                />
              </div>
              <div className={styles.row}>
                <span className={styles.label}>Replace:</span>
                <SearchInput
                  value={options.replaceText}
                  onChange={(v) => setOptions({ replaceText: v })}
                  placeholder="Replacement text…"
                  history={replaceHistory}
                  onKeyDown={replaceInputKeyDown}
                />
              </div>
              <SearchOptionsPanel showInSelection />
              <hr className={styles.divider} />
              <div className={styles.btnRow}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleFindNext}>Find Next</button>
                <button className={styles.btn} onClick={handleReplaceOne}>Replace</button>
                <button className={styles.btn} onClick={handleReplaceAll}>Replace All</button>
                <button className={styles.btn} onClick={handleCount}>Count</button>
              </div>
            </>
          )}

          {/* ── Find in Files Tab ── */}
          {activeTab === 'findInFiles' && (
            <>
              <div className={styles.row}>
                <span className={styles.label}>Find:</span>
                <SearchInput
                  value={options.pattern}
                  onChange={(v) => setOptions({ pattern: v })}
                  placeholder="Search pattern…"
                  history={patternHistory}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleFindInFiles() }}
                  autoFocus
                  inputRef={findInputRef}
                />
              </div>
              <div className={styles.row}>
                <span className={styles.label}>Directory:</span>
                <div className={styles.dirRow} style={{ flex: 1 }}>
                  <input
                    className={styles.input}
                    style={{ flex: 1 }}
                    value={fifDir}
                    onChange={(e) => setFifDir(e.target.value)}
                    placeholder="/path/to/search…"
                    spellCheck={false}
                  />
                  <button className={styles.browseBtn} onClick={handleBrowseDir}>Browse…</button>
                </div>
              </div>
              <div className={styles.row}>
                <span className={styles.label}>Filter:</span>
                <input
                  className={styles.input}
                  style={{ flex: 1 }}
                  value={fifFilter}
                  onChange={(e) => setFifFilter(e.target.value)}
                  placeholder="*.ts *.js (space-separated)"
                  spellCheck={false}
                />
              </div>
              <div className={styles.modeRow}>
                {(['normal', 'extended', 'regex'] as SearchMode[]).map((m) => (
                  <label key={m} className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="searchMode"
                      value={m}
                      checked={options.searchMode === m}
                      onChange={() => setOptions({ searchMode: m })}
                    />
                    {m === 'normal' ? 'Normal' : m === 'extended' ? 'Extended' : 'Regex'}
                  </label>
                ))}
              </div>
              <div className={styles.optionsRow}>
                <label className={styles.checkLabel}>
                  <input type="checkbox" checked={options.isCaseSensitive} onChange={(e) => setOptions({ isCaseSensitive: e.target.checked })} />
                  Match case
                </label>
                <label className={styles.checkLabel}>
                  <input type="checkbox" checked={options.isWholeWord} onChange={(e) => setOptions({ isWholeWord: e.target.checked })} />
                  Whole word
                </label>
                <label className={styles.checkLabel}>
                  <input type="checkbox" checked={fifRecursive} onChange={(e) => setFifRecursive(e.target.checked)} />
                  Recursive
                </label>
              </div>
              <hr className={styles.divider} />
              <div className={styles.btnRow}>
                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={handleFindInFiles}
                  disabled={isSearching}
                >
                  {isSearching ? <span className={styles.loading}>⟳</span> : null}
                  {isSearching ? ' Searching…' : 'Find All'}
                </button>
              </div>
            </>
          )}

          {/* ── Mark Tab ── */}
          {activeTab === 'mark' && (
            <>
              <div className={styles.row}>
                <span className={styles.label}>Find:</span>
                <SearchInput
                  value={options.pattern}
                  onChange={(v) => setOptions({ pattern: v })}
                  placeholder="Pattern to mark…"
                  history={patternHistory}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleMarkAll() }}
                  autoFocus
                  inputRef={findInputRef}
                />
              </div>
              <SearchOptionsPanel />
              <div className={styles.row} style={{ marginTop: 4 }}>
                <span className={styles.label}>Style:</span>
                <div className={styles.markStyles}>
                  {MARK_COLORS_CSS.map((color, i) => (
                    <button
                      key={i}
                      className={`${styles.markSwatch} ${markStyleIndex === i ? styles.markSwatchActive : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setMarkStyleIndex(i)}
                      title={`Mark style ${i + 1}`}
                    />
                  ))}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
                    Style {markStyleIndex + 1}
                  </span>
                </div>
              </div>
              <div className={styles.optionsRow}>
                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    onChange={(e) => { if (e.target.checked) handleBookmark() }}
                  />
                  Also bookmark matched lines
                </label>
              </div>
              <hr className={styles.divider} />
              <div className={styles.btnRow}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleMarkAll}>Mark All</button>
                <button className={styles.btn} onClick={handleClearMarks}>Clear Style {markStyleIndex + 1}</button>
                <button className={styles.btn} onClick={handleClearAllMarks}>Clear All Marks</button>
              </div>
            </>
          )}
        </div>

        {/* Status bar */}
        <div className={styles.statusBar}>
          {status.msg && (
            <span className={status.type === 'ok' ? styles.statusOk : status.type === 'warn' ? styles.statusWarn : ''}>
              {status.msg}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
