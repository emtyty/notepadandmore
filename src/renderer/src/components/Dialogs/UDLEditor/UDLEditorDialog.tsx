import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as monaco from 'monaco-editor'
import { useUIStore } from '../../../store/uiStore'
import { UDLDefinition, udlToMonarch } from '../../../utils/udlToMonarch'
import styles from './UDLEditorDialog.module.css'

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
    <div className={styles.overlay}>
      <div ref={dialogRef} className={styles.dialog} style={dialogStyle}>
        <div className={styles.titleBar} onMouseDown={onTitleMouseDown}>
          <span className={styles.titleText}>User Defined Languages</span>
          <button className={styles.closeBtn} onClick={() => setShowUDLEditor(false)} title="Close">✕</button>
        </div>

        <div className={styles.body}>
          {/* Left panel: language list */}
          <div className={styles.listPanel}>
            <div className={styles.listHeader}>
              <span className={styles.panelLabel}>Languages</span>
              <button className={styles.newBtn} onClick={newLanguage} title="New language">+</button>
            </div>
            {udlList.length === 0 && (
              <div className={styles.emptyList}>No custom languages yet. Click + to create one.</div>
            )}
            {udlList.map((entry) => (
              <button
                key={entry.filename}
                className={`${styles.langItem} ${selected?.filename === entry.filename ? styles.langItemActive : ''}`}
                onClick={() => selectEntry(entry)}
              >
                {entry.udl.name}
                <span className={styles.langExt}>
                  {entry.udl.extensions.map((e) => `.${e}`).join(', ')}
                </span>
              </button>
            ))}
          </div>

          {/* Right panel: editor */}
          <div className={styles.editorArea}>
            {/* Tabs */}
            <div className={styles.tabList}>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  className={`${styles.tabBtn} ${activeTab === t.id ? styles.tabBtnActive : ''}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className={styles.tabContent}>
              {activeTab === 'info' && (
                <div className={styles.section}>
                  <FormRow label="Language Name *">
                    <input
                      type="text"
                      className={styles.textInput}
                      value={draft.name}
                      onChange={(e) => setDraftProp('name', e.target.value)}
                      placeholder="e.g. MyConfig"
                    />
                  </FormRow>
                  <FormRow label="File Extensions">
                    <input
                      type="text"
                      className={styles.textInput}
                      value={draft.extensions.join(', ')}
                      onChange={(e) => setDraftProp('extensions', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                      placeholder="e.g. cfg, conf"
                    />
                    <span className={styles.hint}>Comma-separated, without dots</span>
                  </FormRow>
                  <label className={styles.checkLabel}>
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
                      className={styles.smallInput}
                      value={draft.foldOpen}
                      onChange={(e) => setDraftProp('foldOpen', e.target.value)}
                      placeholder="e.g. {"
                    />
                  </FormRow>
                  <FormRow label="Fold Close">
                    <input
                      type="text"
                      className={styles.smallInput}
                      value={draft.foldClose}
                      onChange={(e) => setDraftProp('foldClose', e.target.value)}
                      placeholder="e.g. }"
                    />
                  </FormRow>
                </div>
              )}

              {activeTab === 'keywords' && (
                <div className={styles.section}>
                  <p className={styles.helpText}>Enter space-separated keywords for each group. Each group can have its own highlight color (configure via Style Configurator → your language).</p>
                  {draft.keywordGroups.map((group, i) => (
                    <div key={i} className={styles.kwGroup}>
                      <label className={styles.kwLabel}>Group {i + 1}</label>
                      <textarea
                        className={styles.kwArea}
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
                <div className={styles.section}>
                  <FormRow label="Operator characters">
                    <input
                      type="text"
                      className={styles.textInput}
                      value={draft.operators}
                      onChange={(e) => setDraftProp('operators', e.target.value)}
                      placeholder="e.g. +-*/=<>!&|^~%"
                    />
                  </FormRow>
                  <p className={styles.helpText}>Each character is treated as a single operator token.</p>
                </div>
              )}

              {activeTab === 'delimiters' && (
                <div className={styles.section}>
                  <p className={styles.helpText}>Define string-like delimiter pairs (e.g. quote characters). Content between open/close is highlighted as a string.</p>
                  {draft.delimiters.map((delim, i) => (
                    <div key={i} className={styles.delimRow}>
                      <span className={styles.delimIdx}>#{i + 1}</span>
                      <FormRow label="Open">
                        <input
                          type="text"
                          className={styles.smallInput}
                          value={delim.open}
                          onChange={(e) => setDelimiter(i, 'open', e.target.value)}
                          placeholder='"'
                        />
                      </FormRow>
                      <FormRow label="Close">
                        <input
                          type="text"
                          className={styles.smallInput}
                          value={delim.close}
                          onChange={(e) => setDelimiter(i, 'close', e.target.value)}
                          placeholder='"'
                        />
                      </FormRow>
                    </div>
                  ))}
                  <button
                    className={styles.addDelimBtn}
                    onClick={() => setDraftProp('delimiters', [...draft.delimiters, { open: '', close: '' }])}
                  >
                    + Add delimiter pair
                  </button>
                </div>
              )}

              {activeTab === 'comments' && (
                <div className={styles.section}>
                  <FormRow label="Line comment prefix">
                    <input
                      type="text"
                      className={styles.smallInput}
                      value={draft.lineComment}
                      onChange={(e) => setDraftProp('lineComment', e.target.value)}
                      placeholder="//"
                    />
                  </FormRow>
                  <FormRow label="Block comment open">
                    <input
                      type="text"
                      className={styles.smallInput}
                      value={draft.blockCommentOpen}
                      onChange={(e) => setDraftProp('blockCommentOpen', e.target.value)}
                      placeholder="/*"
                    />
                  </FormRow>
                  <FormRow label="Block comment close">
                    <input
                      type="text"
                      className={styles.smallInput}
                      value={draft.blockCommentClose}
                      onChange={(e) => setDraftProp('blockCommentClose', e.target.value)}
                      placeholder="*/"
                    />
                  </FormRow>
                </div>
              )}
            </div>

            {error && <div className={styles.errorMsg}>{error}</div>}
          </div>
        </div>

        <div className={styles.footer}>
          {selected && (
            <button className={styles.deleteBtn} onClick={handleDelete}>Delete</button>
          )}
          {saved && <span className={styles.savedMsg}>Saved!</span>}
          <button className={styles.saveBtn} onClick={handleSave}>Save & Register</button>
          <button className={styles.closeFooterBtn} onClick={() => setShowUDLEditor(false)}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ─── Helper sub-component ─────────────────────────────────────────────────────
function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.formRow}>
      <label className={styles.formLabel}>{label}</label>
      <div className={styles.formControl}>{children}</div>
    </div>
  )
}
