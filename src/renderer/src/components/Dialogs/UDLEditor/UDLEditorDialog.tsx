import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as monaco from 'monaco-editor'
import { useUIStore } from '../../../store/uiStore'
import { UDLDefinition, udlToMonarch } from '../../../utils/udlToMonarch'
import { cn } from '../../../lib/utils'

type UDLTab = 'info' | 'keywords' | 'operators' | 'delimiters' | 'comments'

const TABS: { id: UDLTab; label: string }[] = [
  { id: 'info',       label: 'Language Info' },
  { id: 'keywords',   label: 'Keywords' },
  { id: 'operators',  label: 'Operators' },
  { id: 'delimiters', label: 'Delimiters' },
  { id: 'comments',   label: 'Comments' },
]

const EMPTY_UDL = (): UDLDefinition => ({
  name: '',
  extensions: [],
  caseSensitive: true,
  keywordGroups: Array.from({ length: 8 }, () => []),
  operators: '',
  lineComment: '',
  blockCommentOpen: '',
  blockCommentClose: '',
  delimiters: [{ open: '"', close: '"' }, { open: "'", close: "'" }],
  foldOpen: '',
  foldClose: ''
})

// ─── Register / update language in Monaco ────────────────────────────────────
function registerUDL(udl: UDLDefinition) {
  if (!udl.name) return
  const langId = `udl-${udl.name.toLowerCase().replace(/\s+/g, '-')}`
  const extensions = udl.extensions.map((e) => (e.startsWith('.') ? e : `.${e}`))

  const existing = monaco.languages.getLanguages().find((l) => l.id === langId)
  if (!existing) {
    monaco.languages.register({ id: langId, extensions, aliases: [udl.name] })
  }
  monaco.languages.setMonarchTokensProvider(langId, udlToMonarch(udl))
  return langId
}

// ─── Storage ──────────────────────────────────────────────────────────────────
interface UDLEntry { filename: string; udl: UDLDefinition }

async function listUDLs(): Promise<UDLEntry[]> {
  try {
    const files: string[] = await window.api.config.listUDL()
    const entries: UDLEntry[] = []
    for (const filename of files) {
      try {
        const raw = await window.api.config.readRaw(`userDefineLangs/${filename}`)
        if (raw) entries.push({ filename, udl: JSON.parse(raw) as UDLDefinition })
      } catch { /* skip */ }
    }
    return entries
  } catch {
    return []
  }
}

async function saveUDL(udl: UDLDefinition): Promise<void> {
  const filename = `${udl.name.replace(/\s+/g, '_')}.json`
  await window.api.config.writeRaw(`userDefineLangs/${filename}`, JSON.stringify(udl, null, 2))
}

async function deleteUDL(filename: string): Promise<void> {
  // Config handlers don't expose delete; use writeRaw with empty to signal removal
  // For now, we overwrite with a tombstone — a proper delete IPC could be added later
  await window.api.config.writeRaw(`userDefineLangs/${filename}`, '')
}

// ─── Main dialog ──────────────────────────────────────────────────────────────
export function UDLEditorDialog() {
  const { showUDLEditor, setShowUDLEditor } = useUIStore()
  const [udlList, setUdlList] = useState<UDLEntry[]>([])
  const [selected, setSelected] = useState<UDLEntry | null>(null)
  const [draft, setDraft] = useState<UDLDefinition>(EMPTY_UDL())
  const [activeTab, setActiveTab] = useState<UDLTab>('info')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Dragging
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ dragging: false, sx: 0, sy: 0, ox: 0, oy: 0 })

  const reload = async () => {
    const list = await listUDLs()
    setUdlList(list.filter((e) => e.udl?.name))
  }

  useEffect(() => {
    if (showUDLEditor) {
      setPos(null)
      reload()
      setSelected(null)
      setDraft(EMPTY_UDL())
      setActiveTab('info')
    }
  }, [showUDLEditor])

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
    if (!showUDLEditor) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowUDLEditor(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showUDLEditor, setShowUDLEditor])

  const selectEntry = (entry: UDLEntry) => {
    setSelected(entry)
    setDraft({ ...entry.udl })
    setActiveTab('info')
  }

  const newLanguage = () => {
    setSelected(null)
    setDraft(EMPTY_UDL())
    setActiveTab('info')
  }

  const handleSave = async () => {
    setError('')
    if (!draft.name.trim()) { setError('Language name is required.'); return }
    try {
      await saveUDL(draft)
      const langId = registerUDL(draft)
      if (langId) useUIStore.getState().addToast(`Language "${draft.name}" saved and registered (ID: ${langId})`, 'info')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      await reload()
    } catch (err) {
      setError(String(err))
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    if (!confirm(`Delete language "${selected.udl.name}"?`)) return
    await deleteUDL(selected.filename)
    setSelected(null)
    setDraft(EMPTY_UDL())
    await reload()
  }

  const setDraftProp = <K extends keyof UDLDefinition>(key: K, val: UDLDefinition[K]) => {
    setDraft((prev) => ({ ...prev, [key]: val }))
  }

  const setKeywordGroup = (idx: number, text: string) => {
    const groups = [...draft.keywordGroups]
    groups[idx] = text.split(/\s+/).filter(Boolean)
    setDraftProp('keywordGroups', groups)
  }

  const setDelimiter = (idx: number, field: 'open' | 'close', val: string) => {
    const delims = draft.delimiters.map((d, i) => i === idx ? { ...d, [field]: val } : d)
    setDraftProp('delimiters', delims)
  }

  if (!showUDLEditor) return null

  const dialogStyle: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, transform: 'none' }
    : {}

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50">
      <div
        ref={dialogRef}
        className="fixed z-[9001] bg-popover border border-border rounded-lg shadow-2xl min-w-[720px] max-w-[850px] max-h-[85vh] flex flex-col"
        style={dialogStyle}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border cursor-move select-none" onMouseDown={onTitleMouseDown}>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">User Defined Languages</span>
          <button
            className="bg-transparent border-none cursor-pointer text-muted-foreground text-sm w-6 h-6 flex items-center justify-center rounded hover:bg-secondary hover:text-foreground"
            onClick={() => setShowUDLEditor(false)}
            title="Close"
          >✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-[400px]">
          {/* Left panel: language list */}
          <div className="w-[180px] border-r border-border flex flex-col shrink-0">
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-border">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Languages</span>
              <button
                className="bg-transparent border border-border rounded text-foreground cursor-pointer w-6 h-6 flex items-center justify-center text-sm hover:bg-secondary"
                onClick={newLanguage}
                title="New language"
              >+</button>
            </div>
            {udlList.length === 0 && (
              <div className="p-3 text-xs text-muted-foreground text-center">No custom languages yet. Click + to create one.</div>
            )}
            {udlList.map((entry) => (
              <button
                key={entry.filename}
                className={cn(
                  'w-full text-left px-2 py-1.5 text-xs cursor-pointer hover:bg-secondary transition-colors bg-transparent border-none text-foreground flex items-center justify-between',
                  selected?.filename === entry.filename && 'bg-primary/15 text-primary font-medium'
                )}
                onClick={() => selectEntry(entry)}
              >
                {entry.udl.name}
                <span className="text-[10px] text-muted-foreground">
                  {entry.udl.extensions.map((e) => `.${e}`).join(', ')}
                </span>
              </button>
            ))}
          </div>

          {/* Right panel: editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-border shrink-0">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  className={cn(
                    'px-3 py-1.5 text-[11px] font-medium cursor-pointer border-none bg-transparent text-muted-foreground border-b-2 border-transparent -mb-px hover:text-foreground hover:bg-secondary',
                    activeTab === t.id && 'text-primary border-b-primary'
                  )}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3 editor-scrollbar">
              {activeTab === 'info' && (
                <div className="flex flex-col gap-3">
                  <FormRow label="Language Name *">
                    <input
                      type="text"
                      className="bg-input border border-border rounded px-2 py-1 text-xs text-foreground outline-none focus:border-ring w-full"
                      value={draft.name}
                      onChange={(e) => setDraftProp('name', e.target.value)}
                      placeholder="e.g. MyConfig"
                    />
                  </FormRow>
                  <FormRow label="File Extensions">
                    <input
                      type="text"
                      className="bg-input border border-border rounded px-2 py-1 text-xs text-foreground outline-none focus:border-ring w-full"
                      value={draft.extensions.join(', ')}
                      onChange={(e) => setDraftProp('extensions', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                      placeholder="e.g. cfg, conf"
                    />
                    <span className="text-[10px] text-muted-foreground">Comma-separated, without dots</span>
                  </FormRow>
                  <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.caseSensitive}
                      onChange={(e) => setDraftProp('caseSensitive', e.target.checked)}
                    />
                    Case-sensitive matching
                  </label>
                  <FormRow label="Fold Open">
                    <input
                      type="text"
                      className="bg-input border border-border rounded px-2 py-1 text-xs text-foreground outline-none focus:border-ring w-32"
                      value={draft.foldOpen}
                      onChange={(e) => setDraftProp('foldOpen', e.target.value)}
                      placeholder="e.g. {"
                    />
                  </FormRow>
                  <FormRow label="Fold Close">
                    <input
                      type="text"
                      className="bg-input border border-border rounded px-2 py-1 text-xs text-foreground outline-none focus:border-ring w-32"
                      value={draft.foldClose}
                      onChange={(e) => setDraftProp('foldClose', e.target.value)}
                      placeholder="e.g. }"
                    />
                  </FormRow>
                </div>
              )}

              {activeTab === 'keywords' && (
                <div className="flex flex-col gap-3">
                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">Enter space-separated keywords for each group. Each group can have its own highlight color (configure via Style Configurator → your language).</p>
                  {draft.keywordGroups.map((group, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium text-muted-foreground">Group {i + 1}</label>
                      <textarea
                        className="bg-input border border-border rounded px-2 py-1.5 text-xs text-foreground font-mono resize-y outline-none focus:border-ring"
                        value={group.join(' ')}
                        onChange={(e) => setKeywordGroup(i, e.target.value)}
                        placeholder={`Keywords for group ${i + 1}…`}
                        rows={3}
                      />
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'operators' && (
                <div className="flex flex-col gap-3">
                  <FormRow label="Operator characters">
                    <input
                      type="text"
                      className="bg-input border border-border rounded px-2 py-1 text-xs text-foreground outline-none focus:border-ring w-full"
                      value={draft.operators}
                      onChange={(e) => setDraftProp('operators', e.target.value)}
                      placeholder="e.g. +-*/=<>!&|^~%"
                    />
                  </FormRow>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">Each character is treated as a single operator token.</p>
                </div>
              )}

              {activeTab === 'delimiters' && (
                <div className="flex flex-col gap-3">
                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">Define string-like delimiter pairs (e.g. quote characters). Content between open/close is highlighted as a string.</p>
                  {draft.delimiters.map((delim, i) => (
                    <div key={i} className="flex items-center gap-3 mb-2">
                      <span className="text-[11px] text-muted-foreground w-6 shrink-0">#{i + 1}</span>
                      <FormRow label="Open">
                        <input
                          type="text"
                          className="bg-input border border-border rounded px-2 py-1 text-xs text-foreground outline-none focus:border-ring w-32"
                          value={delim.open}
                          onChange={(e) => setDelimiter(i, 'open', e.target.value)}
                          placeholder='"'
                        />
                      </FormRow>
                      <FormRow label="Close">
                        <input
                          type="text"
                          className="bg-input border border-border rounded px-2 py-1 text-xs text-foreground outline-none focus:border-ring w-32"
                          value={delim.close}
                          onChange={(e) => setDelimiter(i, 'close', e.target.value)}
                          placeholder='"'
                        />
                      </FormRow>
                    </div>
                  ))}
                  <button
                    className="text-xs text-primary hover:underline bg-transparent border-none cursor-pointer"
                    onClick={() => setDraftProp('delimiters', [...draft.delimiters, { open: '', close: '' }])}
                  >
                    + Add delimiter pair
                  </button>
                </div>
              )}

              {activeTab === 'comments' && (
                <div className="flex flex-col gap-3">
                  <FormRow label="Line comment prefix">
                    <input
                      type="text"
                      className="bg-input border border-border rounded px-2 py-1 text-xs text-foreground outline-none focus:border-ring w-32"
                      value={draft.lineComment}
                      onChange={(e) => setDraftProp('lineComment', e.target.value)}
                      placeholder="//"
                    />
                  </FormRow>
                  <FormRow label="Block comment open">
                    <input
                      type="text"
                      className="bg-input border border-border rounded px-2 py-1 text-xs text-foreground outline-none focus:border-ring w-32"
                      value={draft.blockCommentOpen}
                      onChange={(e) => setDraftProp('blockCommentOpen', e.target.value)}
                      placeholder="/*"
                    />
                  </FormRow>
                  <FormRow label="Block comment close">
                    <input
                      type="text"
                      className="bg-input border border-border rounded px-2 py-1 text-xs text-foreground outline-none focus:border-ring w-32"
                      value={draft.blockCommentClose}
                      onChange={(e) => setDraftProp('blockCommentClose', e.target.value)}
                      placeholder="*/"
                    />
                  </FormRow>
                </div>
              )}
            </div>

            {error && <div className="text-destructive text-xs px-3 py-1">{error}</div>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-border">
          {selected && (
            <button
              className="px-3 py-1.5 text-xs border-none rounded bg-destructive text-destructive-foreground cursor-pointer hover:bg-destructive/90"
              onClick={handleDelete}
            >Delete</button>
          )}
          {saved && <span className="text-green-500 text-[11px] mr-2">Saved!</span>}
          <button
            className="px-3 py-1.5 text-xs border-none rounded bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors"
            onClick={handleSave}
          >Save & Register</button>
          <button
            className="px-3 py-1.5 text-xs border border-border rounded bg-secondary text-foreground cursor-pointer hover:bg-muted transition-colors"
            onClick={() => setShowUDLEditor(false)}
          >Close</button>
        </div>
      </div>
    </div>
  )
}

// ─── Helper sub-component ─────────────────────────────────────────────────────
function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <label className="text-xs text-muted-foreground w-28 shrink-0 pt-1">{label}</label>
      <div className="flex-1 flex flex-col gap-1">{children}</div>
    </div>
  )
}
