import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useUIStore } from '../../../store/uiStore'
import { useSearchStore, SearchMode } from '../../../store/searchStore'
import { useSearchEngine } from '../../../hooks/useSearchEngine'
import { cn } from '../../../lib/utils'

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
    <div className="absolute top-full left-0 right-0 mt-0.5 bg-popover border border-border rounded shadow-lg z-50 max-h-40 overflow-y-auto editor-scrollbar">
      {items.map((item, i) => (
        <div
          key={i}
          className="px-2 py-1 text-xs text-foreground hover:bg-secondary cursor-pointer truncate"
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
    <div className="relative flex-1">
      <input
        ref={inputRef}
        className="w-full bg-input border border-border rounded px-2 py-1 text-xs text-foreground outline-none focus:border-ring pr-6"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        onFocus={() => history.length > 0 && setShowHistory(false)}
        spellCheck={false}
      />
      <button
        className="absolute right-1 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-muted-foreground text-xs hover:text-foreground"
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
      <div className="flex items-center gap-3 mt-1.5">
        <span className="text-[11px] text-muted-foreground mr-1">Mode:</span>
        {(['normal', 'extended', 'regex'] as SearchMode[]).map((m) => (
          <label key={m} className="flex items-center gap-1 text-[11px] text-foreground cursor-pointer">
            <input
              type="radio"
              name="searchMode"
              value={m}
              checked={options.searchMode === m}
              onChange={() => setOptions({ searchMode: m })}
              className="accent-primary"
            />
            {m === 'normal' ? 'Normal' : m === 'extended' ? 'Extended (\\n \\t …)' : 'Regex'}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-1">
        <label className="flex items-center gap-1 text-[11px] text-foreground cursor-pointer">
          <input type="checkbox" checked={options.isCaseSensitive} onChange={(e) => setOptions({ isCaseSensitive: e.target.checked })} className="accent-primary" />
          Match case
        </label>
        <label className="flex items-center gap-1 text-[11px] text-foreground cursor-pointer">
          <input type="checkbox" checked={options.isWholeWord} onChange={(e) => setOptions({ isWholeWord: e.target.checked })} className="accent-primary" />
          Whole word
        </label>
        <label className="flex items-center gap-1 text-[11px] text-foreground cursor-pointer">
          <input type="checkbox" checked={options.isWrapAround} onChange={(e) => setOptions({ isWrapAround: e.target.checked })} className="accent-primary" />
          Wrap around
        </label>
        {options.searchMode === 'regex' && (
          <label className="flex items-center gap-1 text-[11px] text-foreground cursor-pointer">
            <input type="checkbox" checked={options.dotMatchesNewline} onChange={(e) => setOptions({ dotMatchesNewline: e.target.checked })} className="accent-primary" />
            . matches newline
          </label>
        )}
        {showInSelection && (
          <label className="flex items-center gap-1 text-[11px] text-foreground cursor-pointer">
            <input type="checkbox" checked={options.inSelection} onChange={(e) => setOptions({ inSelection: e.target.checked })} className="accent-primary" />
            In selection
          </label>
        )}
      </div>
    </>
  )
}

// ─── Main dialog ──────────────────────────────────────────────────────────────
export function FindReplaceDialog() {
  const { showFindReplace, findReplaceMode, closeFind, findInitialTerm } = useUIStore()
  const { options, setOptions, patternHistory, replaceHistory, markStyleIndex, setMarkStyleIndex, isSearching, searchProgress, currentSearchId } =
    useSearchStore()
  const engine = useSearchEngine()

  const [activeTab, setActiveTab] = useState<DialogTab>('find')
  useEffect(() => {
    if (showFindReplace) setActiveTab(findReplaceMode as DialogTab)
  }, [showFindReplace, findReplaceMode])

  // Dragging
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ dragging: false, sx: 0, sy: 0, ox: 0, oy: 0 })

  useEffect(() => { if (showFindReplace) setPos(null) }, [showFindReplace])

  const onTitleMouseDown = useCallback((e: React.MouseEvent) => {
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
      setPos({ x: dragRef.current.ox + e.clientX - dragRef.current.sx, y: dragRef.current.oy + e.clientY - dragRef.current.sy })
    }
    const onUp = () => { dragRef.current.dragging = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  useEffect(() => {
    if (!showFindReplace) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeFind() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showFindReplace, closeFind])

  const [status, setStatus] = useState<{ msg: string; type: 'ok' | 'warn' | 'none' }>({ msg: '', type: 'none' })
  const [fifDir, setFifDir] = useState('')
  const [fifFilter, setFifFilter] = useState('*.*')
  const [fifRecursive, setFifRecursive] = useState(true)
  const findInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showFindReplace) {
      if (findInitialTerm) setOptions({ pattern: findInitialTerm })
      setTimeout(() => { findInputRef.current?.focus(); findInputRef.current?.select() }, 50)
    }
  }, [showFindReplace]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!showFindReplace) return null

  // ── Handlers ──
  const handleFindNext = () => { const m = engine.findNext(); setStatus(m ? { msg: '', type: 'none' } : { msg: `"${options.pattern}" not found.`, type: 'warn' }) }
  const handleFindPrev = () => { const m = engine.findPrev(); setStatus(m ? { msg: '', type: 'none' } : { msg: `"${options.pattern}" not found.`, type: 'warn' }) }
  const handleCount = () => { const n = engine.countAll(); setStatus({ msg: `${n} match${n !== 1 ? 'es' : ''} found.`, type: n > 0 ? 'ok' : 'warn' }) }
  const handleFindAll = () => { engine.findAll(); setStatus({ msg: 'Results shown in Find Results panel.', type: 'ok' }) }
  const handleFindAllOpenDocs = () => { engine.findAllInOpenDocs(); setStatus({ msg: 'Results shown in Find Results panel.', type: 'ok' }) }
  const handleReplaceOne = () => { engine.replaceOne() }
  const handleReplaceAll = () => { const n = engine.replaceAll(); setStatus({ msg: n > 0 ? `Replaced ${n} match${n !== 1 ? 'es' : ''}.` : `"${options.pattern}" not found.`, type: n > 0 ? 'ok' : 'warn' }) }
  const handleMarkAll = () => { engine.markAll(markStyleIndex) }
  const handleClearMarks = () => { engine.clearMarks(markStyleIndex); setStatus({ msg: 'Marks cleared.', type: 'none' }) }
  const handleClearAllMarks = () => { engine.clearMarks(); setStatus({ msg: 'All marks cleared.', type: 'none' }) }
  const handleBookmark = () => { engine.bookmarkLines() }
  const handleFindInFiles = () => {
    if (!fifDir) { setStatus({ msg: 'Please select a directory.', type: 'warn' }); return }
    engine.findInFilesStreaming(fifDir, fifFilter, fifRecursive)
    setStatus({ msg: 'Searching… results appear in real-time.', type: 'ok' })
  }
  const handleCancelSearch = () => { engine.cancelFindInFiles(); setStatus({ msg: '', type: 'none' }) }
  const handleBrowseDir = async () => { const result = await (window.api as any).file.openDirDialog?.(); if (result) setFifDir(result) }

  const findInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.shiftKey ? handleFindPrev() : handleFindNext() } }
  const replaceInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') handleReplaceOne() }

  const tabNames: { id: DialogTab; label: string }[] = [
    { id: 'find', label: 'Find' }, { id: 'replace', label: 'Replace' },
    { id: 'findInFiles', label: 'Find in Files' }, { id: 'mark', label: 'Mark' },
  ]

  const btn = "px-3 py-1 text-[11px] border border-border rounded bg-secondary text-foreground cursor-pointer hover:bg-muted transition-colors"
  const btnPrimary = "px-3 py-1 text-[11px] border-none rounded bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors"

  return (
    <div className="fixed inset-0 z-[9000] pointer-events-none">
      <div
        ref={dialogRef}
        className="fixed z-[9001] bg-popover border border-border rounded-lg shadow-2xl min-w-[480px] max-w-[640px] flex flex-col pointer-events-auto"
        style={pos ? { left: pos.x, top: pos.y } : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border cursor-move select-none" onMouseDown={onTitleMouseDown}>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Find & Replace</span>
          <button className="bg-transparent border-none cursor-pointer text-muted-foreground text-sm w-6 h-6 flex items-center justify-center rounded hover:bg-secondary hover:text-foreground" onClick={closeFind} tabIndex={-1} title="Close (Esc)">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {tabNames.map((tab) => (
            <button
              key={tab.id}
              className={cn(
                'px-3 py-1.5 text-[11px] font-medium cursor-pointer border-none bg-transparent text-muted-foreground border-b-2 border-transparent -mb-px transition-colors hover:text-foreground hover:bg-secondary',
                activeTab === tab.id && 'text-primary border-b-primary'
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-3 py-2.5 flex flex-col gap-1.5">
          {/* ── Find Tab ── */}
          {activeTab === 'find' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-14 shrink-0">Find:</span>
                <SearchInput value={options.pattern} onChange={(v) => setOptions({ pattern: v })} placeholder="Search pattern…" history={patternHistory} onKeyDown={findInputKeyDown} autoFocus inputRef={findInputRef} />
              </div>
              <SearchOptionsPanel showInSelection />
              <hr className="border-border my-1" />
              <div className="flex gap-1.5 flex-wrap">
                <button className={btnPrimary} onClick={handleFindNext}>Find Next ↓</button>
                <button className={btn} onClick={handleFindPrev}>Find Prev ↑</button>
                <button className={btn} onClick={handleCount}>Count</button>
                <button className={btn} onClick={handleFindAll}>Find All (this doc)</button>
                <button className={btn} onClick={handleFindAllOpenDocs}>Find All (open docs)</button>
              </div>
            </>
          )}

          {/* ── Replace Tab ── */}
          {activeTab === 'replace' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-14 shrink-0">Find:</span>
                <SearchInput value={options.pattern} onChange={(v) => setOptions({ pattern: v })} placeholder="Search pattern…" history={patternHistory} onKeyDown={findInputKeyDown} autoFocus inputRef={findInputRef} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-14 shrink-0">Replace:</span>
                <SearchInput value={options.replaceText} onChange={(v) => setOptions({ replaceText: v })} placeholder="Replacement text…" history={replaceHistory} onKeyDown={replaceInputKeyDown} />
              </div>
              <SearchOptionsPanel showInSelection />
              <hr className="border-border my-1" />
              <div className="flex gap-1.5 flex-wrap">
                <button className={btnPrimary} onClick={handleFindNext}>Find Next</button>
                <button className={btn} onClick={handleReplaceOne}>Replace</button>
                <button className={btn} onClick={handleReplaceAll}>Replace All</button>
                <button className={btn} onClick={handleCount}>Count</button>
              </div>
            </>
          )}

          {/* ── Find in Files Tab ── */}
          {activeTab === 'findInFiles' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-14 shrink-0">Find:</span>
                <SearchInput value={options.pattern} onChange={(v) => setOptions({ pattern: v })} placeholder="Search pattern…" history={patternHistory} onKeyDown={(e) => { if (e.key === 'Enter') handleFindInFiles() }} autoFocus inputRef={findInputRef} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-14 shrink-0">Directory:</span>
                <div className="flex flex-1 gap-1.5">
                  <input className="flex-1 bg-input border border-border rounded px-2 py-1 text-xs text-foreground outline-none focus:border-ring" value={fifDir} onChange={(e) => setFifDir(e.target.value)} placeholder="/path/to/search…" spellCheck={false} />
                  <button className={btn} onClick={handleBrowseDir}>Browse…</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-14 shrink-0">Filter:</span>
                <input className="flex-1 bg-input border border-border rounded px-2 py-1 text-xs text-foreground outline-none focus:border-ring" value={fifFilter} onChange={(e) => setFifFilter(e.target.value)} placeholder="*.ts *.js (space-separated)" spellCheck={false} />
              </div>
              <div className="flex items-center gap-3 mt-1">
                {(['normal', 'extended', 'regex'] as SearchMode[]).map((m) => (
                  <label key={m} className="flex items-center gap-1 text-[11px] text-foreground cursor-pointer">
                    <input type="radio" name="searchMode" value={m} checked={options.searchMode === m} onChange={() => setOptions({ searchMode: m })} className="accent-primary" />
                    {m === 'normal' ? 'Normal' : m === 'extended' ? 'Extended' : 'Regex'}
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <label className="flex items-center gap-1 text-[11px] text-foreground cursor-pointer">
                  <input type="checkbox" checked={options.isCaseSensitive} onChange={(e) => setOptions({ isCaseSensitive: e.target.checked })} className="accent-primary" />Match case
                </label>
                <label className="flex items-center gap-1 text-[11px] text-foreground cursor-pointer">
                  <input type="checkbox" checked={options.isWholeWord} onChange={(e) => setOptions({ isWholeWord: e.target.checked })} className="accent-primary" />Whole word
                </label>
                <label className="flex items-center gap-1 text-[11px] text-foreground cursor-pointer">
                  <input type="checkbox" checked={fifRecursive} onChange={(e) => setFifRecursive(e.target.checked)} className="accent-primary" />Recursive
                </label>
              </div>
              <hr className="border-border my-1" />
              <div className="flex gap-1.5 items-center">
                <button className={btnPrimary} onClick={handleFindInFiles} disabled={isSearching}>
                  {isSearching ? <span className="inline-block animate-spin mr-1">⟳</span> : null}
                  {isSearching ? 'Searching…' : 'Find All'}
                </button>
                {isSearching && currentSearchId && <button className={btn} onClick={handleCancelSearch}>Cancel</button>}
              </div>
              {isSearching && searchProgress && searchProgress.scanned > 0 && (
                <div className="text-[11px] text-primary mt-1">Scanning {searchProgress.scanned} files…</div>
              )}
            </>
          )}

          {/* ── Mark Tab ── */}
          {activeTab === 'mark' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-14 shrink-0">Find:</span>
                <SearchInput value={options.pattern} onChange={(v) => setOptions({ pattern: v })} placeholder="Pattern to mark…" history={patternHistory} onKeyDown={(e) => { if (e.key === 'Enter') handleMarkAll() }} autoFocus inputRef={findInputRef} />
              </div>
              <SearchOptionsPanel />
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-muted-foreground w-14 shrink-0">Style:</span>
                <div className="flex items-center gap-1.5">
                  {MARK_COLORS_CSS.map((color, i) => (
                    <button
                      key={i}
                      className={cn('w-5 h-5 rounded border-2 cursor-pointer transition-colors', markStyleIndex === i ? 'border-foreground scale-110' : 'border-transparent')}
                      style={{ backgroundColor: color }}
                      onClick={() => setMarkStyleIndex(i)}
                      title={`Mark style ${i + 1}`}
                    />
                  ))}
                  <span className="text-[11px] text-muted-foreground ml-1">Style {markStyleIndex + 1}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <label className="flex items-center gap-1 text-[11px] text-foreground cursor-pointer">
                  <input type="checkbox" onChange={(e) => { if (e.target.checked) handleBookmark() }} className="accent-primary" />
                  Also bookmark matched lines
                </label>
              </div>
              <hr className="border-border my-1" />
              <div className="flex gap-1.5 flex-wrap">
                <button className={btnPrimary} onClick={handleMarkAll}>Mark All</button>
                <button className={btn} onClick={handleClearMarks}>Clear Style {markStyleIndex + 1}</button>
                <button className={btn} onClick={handleClearAllMarks}>Clear All Marks</button>
              </div>
            </>
          )}
        </div>

        {/* Status bar */}
        <div className="px-3 py-1.5 border-t border-border min-h-[24px] text-[11px]">
          {status.msg && (
            <span className={cn(status.type === 'ok' && 'text-green-500', status.type === 'warn' && 'text-yellow-500')}>
              {status.msg}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
