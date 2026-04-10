import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useUIStore } from '../../../store/uiStore'
import { cn } from '../../../lib/utils'

interface CommandDef {
  id: string
  label: string
  category: string
  defaultShortcut: string
}

const BUILT_IN_COMMANDS: CommandDef[] = [
  // File
  { id: 'file:new',         label: 'New File',                category: 'File',   defaultShortcut: 'Ctrl+N' },
  { id: 'file:open',        label: 'Open File',               category: 'File',   defaultShortcut: 'Ctrl+O' },
  { id: 'file:save',        label: 'Save',                    category: 'File',   defaultShortcut: 'Ctrl+S' },
  { id: 'file:save-as',     label: 'Save As',                 category: 'File',   defaultShortcut: 'Ctrl+Shift+S' },
  { id: 'file:save-all',    label: 'Save All',                category: 'File',   defaultShortcut: 'Ctrl+Alt+S' },
  { id: 'file:close',       label: 'Close',                   category: 'File',   defaultShortcut: 'Ctrl+W' },
  { id: 'file:reload',      label: 'Reload from Disk',        category: 'File',   defaultShortcut: 'Ctrl+R' },
  // Edit
  { id: 'edit:undo',        label: 'Undo',                    category: 'Edit',   defaultShortcut: 'Ctrl+Z' },
  { id: 'edit:redo',        label: 'Redo',                    category: 'Edit',   defaultShortcut: 'Ctrl+Y' },
  { id: 'edit:cut',         label: 'Cut',                     category: 'Edit',   defaultShortcut: 'Ctrl+X' },
  { id: 'edit:copy',        label: 'Copy',                    category: 'Edit',   defaultShortcut: 'Ctrl+C' },
  { id: 'edit:paste',       label: 'Paste',                   category: 'Edit',   defaultShortcut: 'Ctrl+V' },
  { id: 'edit:select-all',  label: 'Select All',              category: 'Edit',   defaultShortcut: 'Ctrl+A' },
  { id: 'edit:dup-line',    label: 'Duplicate Line',          category: 'Edit',   defaultShortcut: 'Ctrl+Shift+D' },
  { id: 'edit:del-line',    label: 'Delete Line',             category: 'Edit',   defaultShortcut: 'Ctrl+Shift+K' },
  { id: 'edit:comment',     label: 'Toggle Comment',          category: 'Edit',   defaultShortcut: 'Ctrl+/' },
  // Search
  { id: 'search:find',      label: 'Find',                    category: 'Search', defaultShortcut: 'Ctrl+F' },
  { id: 'search:replace',   label: 'Replace',                 category: 'Search', defaultShortcut: 'Ctrl+H' },
  { id: 'search:find-in-files', label: 'Find in Files',       category: 'Search', defaultShortcut: 'Ctrl+Shift+F' },
  { id: 'search:goto-line', label: 'Go to Line',              category: 'Search', defaultShortcut: 'Ctrl+G' },
  { id: 'search:bookmark',  label: 'Toggle Bookmark',         category: 'Search', defaultShortcut: 'Ctrl+F2' },
  { id: 'search:next-bm',   label: 'Next Bookmark',           category: 'Search', defaultShortcut: 'F2' },
  { id: 'search:prev-bm',   label: 'Previous Bookmark',       category: 'Search', defaultShortcut: 'Shift+F2' },
  // View
  { id: 'view:sidebar',     label: 'Toggle Sidebar',          category: 'View',   defaultShortcut: 'Ctrl+B' },
  { id: 'view:word-wrap',   label: 'Toggle Word Wrap',        category: 'View',   defaultShortcut: 'Alt+Z' },
  { id: 'view:zoom-in',     label: 'Zoom In',                 category: 'View',   defaultShortcut: 'Ctrl+=' },
  { id: 'view:zoom-out',    label: 'Zoom Out',                category: 'View',   defaultShortcut: 'Ctrl+-' },
  { id: 'view:zoom-reset',  label: 'Zoom Reset',              category: 'View',   defaultShortcut: 'Ctrl+0' },
  // Settings
  { id: 'settings:prefs',   label: 'Preferences',             category: 'Settings', defaultShortcut: 'Ctrl+,' },
  // Macro
  { id: 'macro:record',     label: 'Start Recording',         category: 'Macro',  defaultShortcut: 'Ctrl+Shift+R' },
  { id: 'macro:stop',       label: 'Stop Recording',          category: 'Macro',  defaultShortcut: '' },
  { id: 'macro:play',       label: 'Playback Macro',          category: 'Macro',  defaultShortcut: 'Ctrl+Shift+P' },
  // Tabs
  { id: 'tab:next',         label: 'Next Tab',                category: 'Tabs',   defaultShortcut: 'Ctrl+Tab' },
  { id: 'tab:prev',         label: 'Previous Tab',            category: 'Tabs',   defaultShortcut: 'Ctrl+Shift+Tab' },
]

type ShortcutMap = Record<string, string>

function formatKeyEvent(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  const key = e.key
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    parts.push(key.length === 1 ? key.toUpperCase() : key)
  }
  return parts.join('+')
}

async function loadShortcuts(): Promise<ShortcutMap> {
  try {
    const raw = await window.api.config.readRaw('shortcuts.json')
    if (raw) return JSON.parse(raw) as ShortcutMap
  } catch { /* empty */ }
  return {}
}

async function saveShortcuts(map: ShortcutMap): Promise<void> {
  await window.api.config.writeRaw('shortcuts.json', JSON.stringify(map, null, 2))
}

export function ShortcutMapperDialog() {
  const { showShortcutMapper, setShowShortcutMapper } = useUIStore()
  const [customMap, setCustomMap] = useState<ShortcutMap>({})
  const [filter, setFilter] = useState('')
  const [capturingId, setCapturingId] = useState<string | null>(null)
  const [capturedKey, setCapturedKey] = useState('')
  const [conflict, setConflict] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Dragging
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ dragging: false, sx: 0, sy: 0, ox: 0, oy: 0 })

  useEffect(() => {
    if (showShortcutMapper) {
      setPos(null)
      loadShortcuts().then(setCustomMap)
      setFilter('')
      setCapturingId(null)
    }
  }, [showShortcutMapper])

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
    if (!showShortcutMapper) return
    const onKey = (e: KeyboardEvent) => {
      if (capturingId) {
        e.preventDefault()
        if (e.key === 'Escape') {
          setCapturingId(null)
          setCapturedKey('')
          setConflict(null)
          return
        }
        const combo = formatKeyEvent(e)
        if (combo && !['Ctrl', 'Alt', 'Shift'].includes(combo)) {
          setCapturedKey(combo)
          // Check conflict
          const existingId = BUILT_IN_COMMANDS.find((c) => {
            const current = customMap[c.id] ?? c.defaultShortcut
            return current === combo && c.id !== capturingId
          })?.id
          setConflict(existingId ?? null)
        }
      } else if (e.key === 'Escape') {
        setShowShortcutMapper(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showShortcutMapper, capturingId, customMap, setShowShortcutMapper])

  const currentShortcut = (cmd: CommandDef) => customMap[cmd.id] ?? cmd.defaultShortcut
  const isModified = (cmd: CommandDef) => cmd.id in customMap && customMap[cmd.id] !== cmd.defaultShortcut

  const handleRowClick = (id: string) => {
    setCapturingId(id)
    setCapturedKey('')
    setConflict(null)
  }

  const applyCapture = () => {
    if (!capturingId || !capturedKey) return
    setCustomMap((prev) => ({ ...prev, [capturingId]: capturedKey }))
    setCapturingId(null)
    setCapturedKey('')
    setConflict(null)
  }

  const resetCommand = (id: string) => {
    setCustomMap((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const handleSave = async () => {
    await saveShortcuts(customMap)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const filtered = BUILT_IN_COMMANDS.filter((c) =>
    !filter || c.label.toLowerCase().includes(filter.toLowerCase()) || c.category.toLowerCase().includes(filter.toLowerCase())
  )

  if (!showShortcutMapper) return null

  const dialogStyle: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, transform: 'none' }
    : {}

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50">
      <div
        ref={dialogRef}
        className="fixed z-[9001] bg-popover border border-border rounded-lg shadow-2xl min-w-[680px] max-w-[800px] max-h-[85vh] flex flex-col"
        style={dialogStyle}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border cursor-move select-none" onMouseDown={onTitleMouseDown}>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shortcut Mapper</span>
          <button
            className="bg-transparent border-none cursor-pointer text-muted-foreground text-sm w-6 h-6 flex items-center justify-center rounded hover:bg-secondary hover:text-foreground"
            onClick={() => setShowShortcutMapper(false)}
            title="Close"
          >✕</button>
        </div>

        <div className="flex items-center gap-3 px-3 py-2 border-b border-border">
          <input
            className="flex-1 bg-input border border-border rounded px-2 py-1 text-xs text-foreground outline-none focus:border-ring"
            placeholder="Filter commands..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">Click a row to rebind • Esc to cancel</span>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[400px] editor-scrollbar">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left p-2 border-b border-border text-muted-foreground font-medium text-[11px] sticky top-0 bg-popover z-[1]">Category</th>
                <th className="text-left p-2 border-b border-border text-muted-foreground font-medium text-[11px] sticky top-0 bg-popover z-[1]">Command</th>
                <th className="text-left p-2 border-b border-border text-muted-foreground font-medium text-[11px] sticky top-0 bg-popover z-[1]">Shortcut</th>
                <th className="text-left p-2 border-b border-border text-muted-foreground font-medium text-[11px] sticky top-0 bg-popover z-[1]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cmd) => {
                const isCapturing = capturingId === cmd.id
                const modified = isModified(cmd)
                return (
                  <tr
                    key={cmd.id}
                    className={cn(
                      'cursor-pointer hover:bg-secondary/50',
                      isCapturing && 'bg-primary/10'
                    )}
                    onClick={() => !isCapturing && handleRowClick(cmd.id)}
                  >
                    <td className="p-2 border-b border-border">{cmd.category}</td>
                    <td className="p-2 border-b border-border">{cmd.label}</td>
                    <td className="p-2 border-b border-border">
                      {isCapturing ? (
                        <div className="flex items-center gap-2">
                          <span className="text-primary text-[11px] font-medium animate-pulse">
                            {capturedKey || 'Press keys...'}
                          </span>
                          {capturedKey && (
                            <>
                              {conflict && (
                                <span className="text-destructive text-[11px]" title={`Conflicts with: ${BUILT_IN_COMMANDS.find((c) => c.id === conflict)?.label}`}>
                                  ⚠ conflict
                                </span>
                              )}
                              <button
                                className="px-2 py-0.5 text-[11px] bg-primary text-primary-foreground rounded hover:bg-primary/90"
                                onClick={(e) => { e.stopPropagation(); applyCapture() }}
                              >Apply</button>
                              <button
                                className="px-2 py-0.5 text-[11px] bg-secondary text-foreground rounded hover:bg-muted"
                                onClick={(e) => { e.stopPropagation(); setCapturingId(null) }}
                              >Cancel</button>
                            </>
                          )}
                        </div>
                      ) : (
                        <kbd className={cn(
                          'bg-muted px-2 py-0.5 rounded text-[11px] font-mono',
                          modified && 'text-primary font-semibold'
                        )}>
                          {currentShortcut(cmd) || '—'}
                        </kbd>
                      )}
                    </td>
                    <td className="p-2 border-b border-border">
                      {modified && (
                        <button
                          className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground"
                          onClick={(e) => { e.stopPropagation(); resetCommand(cmd.id) }}
                          title="Reset to default"
                        >
                          ↺
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-border">
          {saved && <span className="text-green-500 text-[11px] mr-2">Saved!</span>}
          <button
            className="px-3 py-1.5 text-xs border-none rounded bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors"
            onClick={handleSave}
          >Save</button>
          <button
            className="px-3 py-1.5 text-xs border border-border rounded bg-secondary text-foreground cursor-pointer hover:bg-muted transition-colors"
            onClick={() => setShowShortcutMapper(false)}
          >Close</button>
        </div>
      </div>
    </div>
  )
}
