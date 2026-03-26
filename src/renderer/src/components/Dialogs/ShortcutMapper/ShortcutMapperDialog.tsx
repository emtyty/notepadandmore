import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useUIStore } from '../../../store/uiStore'
import styles from './ShortcutMapperDialog.module.css'

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
    <div className={styles.overlay}>
      <div ref={dialogRef} className={styles.dialog} style={dialogStyle}>
        <div className={styles.titleBar} onMouseDown={onTitleMouseDown}>
          <span className={styles.titleText}>Shortcut Mapper</span>
          <button className={styles.closeBtn} onClick={() => setShowShortcutMapper(false)} title="Close">✕</button>
        </div>

        <div className={styles.toolbar}>
          <input
            className={styles.filterInput}
            placeholder="Filter commands..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <span className={styles.hint}>Click a row to rebind • Esc to cancel</span>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Category</th>
                <th className={styles.th}>Command</th>
                <th className={styles.th}>Shortcut</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cmd) => {
                const isCapturing = capturingId === cmd.id
                const modified = isModified(cmd)
                return (
                  <tr
                    key={cmd.id}
                    className={`${styles.row} ${isCapturing ? styles.rowCapturing : ''} ${modified ? styles.rowModified : ''}`}
                    onClick={() => !isCapturing && handleRowClick(cmd.id)}
                  >
                    <td className={styles.td}>{cmd.category}</td>
                    <td className={styles.td}>{cmd.label}</td>
                    <td className={styles.td}>
                      {isCapturing ? (
                        <div className={styles.captureCell}>
                          <span className={styles.capturing}>
                            {capturedKey || 'Press keys...'}
                          </span>
                          {capturedKey && (
                            <>
                              {conflict && (
                                <span className={styles.conflict} title={`Conflicts with: ${BUILT_IN_COMMANDS.find((c) => c.id === conflict)?.label}`}>
                                  ⚠ conflict
                                </span>
                              )}
                              <button className={styles.applyBtn} onClick={(e) => { e.stopPropagation(); applyCapture() }}>Apply</button>
                              <button className={styles.cancelBtn} onClick={(e) => { e.stopPropagation(); setCapturingId(null) }}>Cancel</button>
                            </>
                          )}
                        </div>
                      ) : (
                        <kbd className={`${styles.kbd} ${modified ? styles.kbdModified : ''}`}>
                          {currentShortcut(cmd) || '—'}
                        </kbd>
                      )}
                    </td>
                    <td className={styles.td}>
                      {modified && (
                        <button
                          className={styles.resetBtn}
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

        <div className={styles.footer}>
          {saved && <span className={styles.savedMsg}>Saved!</span>}
          <button className={styles.saveBtn} onClick={handleSave}>Save</button>
          <button className={styles.closeFooterBtn} onClick={() => setShowShortcutMapper(false)}>Close</button>
        </div>
      </div>
    </div>
  )
}
