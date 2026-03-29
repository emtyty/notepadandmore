import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useUIStore } from '../../../store/uiStore'
import { useConfigStore, AppConfig } from '../../../store/configStore'
import styles from './PreferencesDialog.module.css'

type PrefTab = 'general' | 'editor' | 'appearance' | 'newDoc' | 'backup' | 'completion'

const TABS: { id: PrefTab; label: string }[] = [
  { id: 'general',    label: 'General' },
  { id: 'editor',     label: 'Editor' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'newDoc',     label: 'New Document' },
  { id: 'backup',     label: 'Backup / AutoSave' },
  { id: 'completion', label: 'Auto-Completion' },
]

const ENCODINGS = [
  'UTF-8', 'UTF-8 BOM', 'UTF-16 LE', 'UTF-16 BE',
  'Windows-1252', 'ISO-8859-1', 'ASCII'
]

const MONO_FONTS = [
  "'Cascadia Code', 'Fira Code', Consolas, 'Courier New', monospace",
  "Consolas, 'Courier New', monospace",
  "'Fira Code', monospace",
  "'JetBrains Mono', monospace",
  "'Source Code Pro', monospace",
  "monospace",
]

export function PreferencesDialog() {
  const { showPreferences, setShowPreferences } = useUIStore()
  const config = useConfigStore()
  const [activeTab, setActiveTab] = useState<PrefTab>('general')

  // Dragging
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ dragging: false, sx: 0, sy: 0, ox: 0, oy: 0 })

  useEffect(() => { if (showPreferences) setPos(null) }, [showPreferences])

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
    if (!showPreferences) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowPreferences(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showPreferences, setShowPreferences])

  if (!showPreferences) return null

  const set = <K extends keyof AppConfig>(key: K, val: AppConfig[K]) => config.setProp(key, val)

  const dialogStyle: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, transform: 'none' }
    : {}

  return (
    <div className={styles.overlay}>
      <div ref={dialogRef} className={styles.dialog} style={dialogStyle}>
        <div className={styles.titleBar} onMouseDown={onTitleMouseDown}>
          <span className={styles.titleText}>Preferences</span>
          <button className={styles.closeBtn} onClick={() => setShowPreferences(false)} title="Close">✕</button>
        </div>

        <div className={styles.body}>
          {/* Tab list */}
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

          {/* Tab content */}
          <div className={styles.tabContent}>
            {activeTab === 'general' && (
              <div className={styles.section}>
                <Row label="Max recent files">
                  <input
                    type="number" min={1} max={50}
                    className={styles.numInput}
                    value={config.maxRecentFiles}
                    onChange={(e) => set('maxRecentFiles', Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </Row>
                <Row label="UI Language">
                  <select className={styles.select} value={config.language} onChange={(e) => set('language', e.target.value)}>
                    <option value="en">English</option>
                  </select>
                </Row>
              </div>
            )}

            {activeTab === 'editor' && (
              <div className={styles.section}>
                <Row label="Font family">
                  <select className={styles.select} value={config.fontFamily} onChange={(e) => set('fontFamily', e.target.value)}>
                    {MONO_FONTS.map((f) => (
                      <option key={f} value={f}>{f.split(',')[0].replace(/'/g, '')}</option>
                    ))}
                  </select>
                </Row>
                <Row label="Font size">
                  <input
                    type="number" min={8} max={32}
                    className={styles.numInput}
                    value={config.fontSize}
                    onChange={(e) => set('fontSize', Math.max(8, parseInt(e.target.value) || 14))}
                  />
                  <span className={styles.unit}>px</span>
                </Row>
                <Row label="Tab size">
                  <input
                    type="number" min={1} max={16}
                    className={styles.numInput}
                    value={config.tabSize}
                    onChange={(e) => set('tabSize', Math.max(1, parseInt(e.target.value) || 4))}
                  />
                </Row>
                <CheckRow label="Insert spaces (not tabs)" checked={config.insertSpaces} onChange={(v) => set('insertSpaces', v)} />
                <CheckRow label="Word wrap" checked={config.wordWrap} onChange={(v) => set('wordWrap', v)} />
                <CheckRow label="Show line numbers" checked={config.showLineNumbers} onChange={(v) => set('showLineNumbers', v)} />
                <CheckRow label="Highlight current line" checked={config.highlightCurrentLine} onChange={(v) => set('highlightCurrentLine', v)} />
                <CheckRow label="Render indentation guides" checked={config.renderIndentGuides} onChange={(v) => set('renderIndentGuides', v)} />
                <CheckRow label="Bracket pair colorization" checked={config.bracketPairColorization} onChange={(v) => set('bracketPairColorization', v)} />
                <CheckRow label="Show minimap" checked={config.showMinimap} onChange={(v) => set('showMinimap', v)} />
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className={styles.section}>
                <Row label="Theme">
                  <select
                    className={styles.select}
                    value={config.theme}
                    onChange={(e) => {
                      const t = e.target.value as 'light' | 'dark'
                      useUIStore.getState().setTheme(t)
                      set('theme', t)
                    }}
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </Row>
                <Row label="Render whitespace">
                  <select
                    className={styles.select}
                    value={config.renderWhitespace}
                    onChange={(e) => set('renderWhitespace', e.target.value as AppConfig['renderWhitespace'])}
                  >
                    <option value="none">None</option>
                    <option value="boundary">Boundary</option>
                    <option value="all">All</option>
                  </select>
                </Row>
              </div>
            )}

            {activeTab === 'newDoc' && (
              <div className={styles.section}>
                <Row label="Default EOL">
                  <select
                    className={styles.select}
                    value={config.defaultEol}
                    onChange={(e) => set('defaultEol', e.target.value as AppConfig['defaultEol'])}
                  >
                    <option value="LF">LF (Unix/macOS)</option>
                    <option value="CRLF">CRLF (Windows)</option>
                    <option value="CR">CR (old macOS)</option>
                  </select>
                </Row>
                <Row label="Default encoding">
                  <select className={styles.select} value={config.defaultEncoding} onChange={(e) => set('defaultEncoding', e.target.value)}>
                    {ENCODINGS.map((enc) => <option key={enc} value={enc}>{enc}</option>)}
                  </select>
                </Row>
                <Row label="Default language">
                  <input
                    type="text"
                    className={styles.textInput}
                    value={config.defaultLanguage}
                    onChange={(e) => set('defaultLanguage', e.target.value)}
                    placeholder="plaintext"
                  />
                </Row>
              </div>
            )}

            {activeTab === 'backup' && (
              <div className={styles.section}>
                <CheckRow label="Enable AutoSave" checked={config.autoSaveEnabled} onChange={(v) => set('autoSaveEnabled', v)} />
                {config.autoSaveEnabled && (
                  <Row label="AutoSave interval">
                    <input
                      type="number" min={5000} max={600000} step={5000}
                      className={styles.numInput}
                      value={config.autoSaveIntervalMs / 1000}
                      onChange={(e) => set('autoSaveIntervalMs', Math.max(5, parseInt(e.target.value) || 60) * 1000)}
                    />
                    <span className={styles.unit}>seconds</span>
                  </Row>
                )}
                <CheckRow label="Enable file backup on save" checked={config.backupEnabled} onChange={(v) => set('backupEnabled', v)} />
                {config.backupEnabled && (
                  <Row label="Backup directory">
                    <input
                      type="text"
                      className={styles.textInput}
                      value={config.backupDir}
                      onChange={(e) => set('backupDir', e.target.value)}
                      placeholder="Leave empty for default"
                    />
                  </Row>
                )}
              </div>
            )}

            {activeTab === 'completion' && (
              <div className={styles.section}>
                <CheckRow label="Enable auto-complete suggestions" checked={config.autoCompleteEnabled} onChange={(v) => set('autoCompleteEnabled', v)} />
                <CheckRow label="Auto-close brackets" checked={config.autoCloseBrackets} onChange={(v) => set('autoCloseBrackets', v)} />
                <CheckRow label="Auto-close quotes" checked={config.autoCloseQuotes} onChange={(v) => set('autoCloseQuotes', v)} />
                <CheckRow label="Word-based suggestions" checked={config.wordBasedSuggestions} onChange={(v) => set('wordBasedSuggestions', v)} />
              </div>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.closeFooterBtn} onClick={() => setShowPreferences(false)}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ─── Helper sub-components ────────────────────────────────────────────────────
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.row}>
      <label className={styles.rowLabel}>{label}</label>
      <div className={styles.rowControl}>{children}</div>
    </div>
  )
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={styles.checkRow}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}
