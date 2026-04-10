import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as monaco from 'monaco-editor'
import { useUIStore } from '../../../store/uiStore'
import { cn } from '../../../lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────
export interface TokenStyle {
  tokenType: string
  foreground: string
  background: string
  bold: boolean
  italic: boolean
}

export interface LanguageTheme {
  languageId: string
  tokens: TokenStyle[]
}

type StylesMap = Record<string, TokenStyle[]>

// ─── Built-in token types per language category ─────────────────────────────
const COMMON_TOKENS: string[] = [
  'comment', 'keyword', 'string', 'number', 'operator',
  'identifier', 'type', 'function', 'variable', 'constant',
  'class', 'namespace', 'parameter', 'property', 'regexp',
  'delimiter', 'tag', 'attribute'
]

const LANGUAGES = [
  { id: 'global',      label: 'Global / Default' },
  { id: 'javascript',  label: 'JavaScript' },
  { id: 'typescript',  label: 'TypeScript' },
  { id: 'python',      label: 'Python' },
  { id: 'cpp',         label: 'C++' },
  { id: 'c',           label: 'C' },
  { id: 'csharp',      label: 'C#' },
  { id: 'java',        label: 'Java' },
  { id: 'go',          label: 'Go' },
  { id: 'rust',        label: 'Rust' },
  { id: 'html',        label: 'HTML' },
  { id: 'css',         label: 'CSS' },
  { id: 'json',        label: 'JSON' },
  { id: 'xml',         label: 'XML' },
  { id: 'markdown',    label: 'Markdown' },
  { id: 'sql',         label: 'SQL' },
  { id: 'shell',       label: 'Shell' },
  { id: 'yaml',        label: 'YAML' },
]

// VS-Dark defaults used as fallback
const VS_DARK_DEFAULTS: Record<string, Partial<TokenStyle>> = {
  comment:    { foreground: '#6A9955' },
  keyword:    { foreground: '#569CD6', bold: true },
  string:     { foreground: '#CE9178' },
  number:     { foreground: '#B5CEA8' },
  operator:   { foreground: '#D4D4D4' },
  type:       { foreground: '#4EC9B0' },
  function:   { foreground: '#DCDCAA' },
  variable:   { foreground: '#9CDCFE' },
  constant:   { foreground: '#4FC1FF' },
  class:      { foreground: '#4EC9B0' },
  parameter:  { foreground: '#9CDCFE', italic: true },
  property:   { foreground: '#9CDCFE' },
  tag:        { foreground: '#569CD6' },
  attribute:  { foreground: '#9CDCFE' },
}

function defaultToken(tokenType: string): TokenStyle {
  const def = VS_DARK_DEFAULTS[tokenType] ?? {}
  return {
    tokenType,
    foreground: def.foreground ?? '#D4D4D4',
    background: '',
    bold: def.bold ?? false,
    italic: def.italic ?? false
  }
}

// ─── Storage helpers ─────────────────────────────────────────────────────────
async function loadStyles(): Promise<StylesMap> {
  try {
    const raw = await window.api.config.readRaw('stylers.json')
    if (raw) return JSON.parse(raw) as StylesMap
  } catch { /* empty */ }
  return {}
}

async function saveStyles(map: StylesMap): Promise<void> {
  await window.api.config.writeRaw('stylers.json', JSON.stringify(map, null, 2))
}

// ─── Apply theme to Monaco ───────────────────────────────────────────────────
export function applyStylesTheme(stylesMap: StylesMap, baseTheme: 'vs-dark' | 'vs') {
  const rules: monaco.editor.ITokenThemeRule[] = []
  for (const [langId, tokens] of Object.entries(stylesMap)) {
    for (const tok of tokens) {
      const scope = langId === 'global' ? tok.tokenType : `${tok.tokenType}.${langId}`
      const rule: monaco.editor.ITokenThemeRule = { token: scope }
      if (tok.foreground) rule.foreground = tok.foreground.replace('#', '')
      if (tok.background) rule.background = tok.background.replace('#', '')
      if (tok.bold && tok.italic) rule.fontStyle = 'bold italic'
      else if (tok.bold) rule.fontStyle = 'bold'
      else if (tok.italic) rule.fontStyle = 'italic'
      rules.push(rule)
    }
  }
  const themeName = baseTheme === 'vs-dark' ? 'custom-dark' : 'custom-light'
  monaco.editor.defineTheme(themeName, {
    base: baseTheme,
    inherit: true,
    rules,
    colors: {}
  })
  monaco.editor.setTheme(themeName)
}

// ─── Main dialog ─────────────────────────────────────────────────────────────
export function StyleConfiguratorDialog() {
  const { showStyleConfigurator, setShowStyleConfigurator, theme } = useUIStore()
  const [stylesMap, setStylesMap] = useState<StylesMap>({})
  const [selectedLang, setSelectedLang] = useState('javascript')
  const [selectedToken, setSelectedToken] = useState('keyword')
  const [saved, setSaved] = useState(false)

  // Dragging
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ dragging: false, sx: 0, sy: 0, ox: 0, oy: 0 })

  useEffect(() => {
    if (showStyleConfigurator) {
      setPos(null)
      loadStyles().then(setStylesMap)
    }
  }, [showStyleConfigurator])

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
    if (!showStyleConfigurator) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowStyleConfigurator(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showStyleConfigurator, setShowStyleConfigurator])

  const getTokenStyle = (langId: string, tokenType: string): TokenStyle => {
    const langTokens = stylesMap[langId] ?? []
    return langTokens.find((t) => t.tokenType === tokenType) ?? defaultToken(tokenType)
  }

  const updateTokenStyle = (langId: string, patch: Partial<TokenStyle>) => {
    setStylesMap((prev) => {
      const existing = prev[langId] ?? []
      const idx = existing.findIndex((t) => t.tokenType === selectedToken)
      const current = idx >= 0 ? existing[idx] : defaultToken(selectedToken)
      const updated = { ...current, ...patch }
      const newTokens = idx >= 0
        ? existing.map((t, i) => i === idx ? updated : t)
        : [...existing, updated]
      return { ...prev, [langId]: newTokens }
    })
  }

  const handleSave = async () => {
    await saveStyles(stylesMap)
    applyStylesTheme(stylesMap, theme === 'dark' ? 'vs-dark' : 'vs')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleImport = () => {
    // Full Notepad++ stylers.xml import is a future enhancement.
    // Guide user to the config directory to manually place a stylers.xml.
    window.api.config.getDir().then((dir: string) => {
      useUIStore.getState().addToast(`Place a Notepad++ stylers.xml in: ${dir}`, 'info')
    })
  }

  const current = getTokenStyle(selectedLang, selectedToken)

  if (!showStyleConfigurator) return null

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
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Style Configurator</span>
          <button
            className="bg-transparent border-none cursor-pointer text-muted-foreground text-sm w-6 h-6 flex items-center justify-center rounded hover:bg-secondary hover:text-foreground"
            onClick={() => setShowStyleConfigurator(false)}
            title="Close"
          >✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: language list */}
          <div className="w-[160px] border-r border-border overflow-y-auto shrink-0 editor-scrollbar">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider px-2 py-1.5 border-b border-border">Language</div>
            {LANGUAGES.map((lang) => (
              <button
                key={lang.id}
                className={cn(
                  'w-full text-left px-2 py-1 text-xs cursor-pointer hover:bg-secondary transition-colors bg-transparent border-none text-foreground',
                  selectedLang === lang.id && 'bg-primary/15 text-primary font-medium'
                )}
                onClick={() => setSelectedLang(lang.id)}
              >
                {lang.label}
                {stylesMap[lang.id]?.length ? <span className="text-primary ml-auto text-[10px]" title="Customized">●</span> : null}
              </button>
            ))}
          </div>

          {/* Middle: token list */}
          <div className="w-[140px] border-r border-border overflow-y-auto shrink-0 editor-scrollbar">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider px-2 py-1.5 border-b border-border">Token Type</div>
            {COMMON_TOKENS.map((tok) => (
              <button
                key={tok}
                className={cn(
                  'w-full text-left px-2 py-1 text-xs cursor-pointer hover:bg-secondary transition-colors bg-transparent border-none text-foreground',
                  selectedToken === tok && 'bg-primary/15 text-primary font-medium'
                )}
                onClick={() => setSelectedToken(tok)}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block mr-1.5 shrink-0"
                  style={{ background: getTokenStyle(selectedLang, tok).foreground || 'transparent' }}
                />
                {tok}
              </button>
            ))}
          </div>

          {/* Right: editor */}
          <div className="flex-1 p-3 overflow-y-auto editor-scrollbar">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider px-2 py-1.5 border-b border-border">Style for <strong>{selectedToken}</strong> in <strong>{LANGUAGES.find((l) => l.id === selectedLang)?.label}</strong></div>

            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs text-muted-foreground w-20 shrink-0">Foreground</label>
              <input
                type="color"
                className="w-8 h-6 p-0 border border-border rounded cursor-pointer"
                value={current.foreground || '#D4D4D4'}
                onChange={(e) => updateTokenStyle(selectedLang, { tokenType: selectedToken, foreground: e.target.value })}
              />
              <span className="text-[11px] text-muted-foreground font-mono">{current.foreground || 'default'}</span>
              <button
                className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground text-xs"
                onClick={() => updateTokenStyle(selectedLang, { tokenType: selectedToken, foreground: '' })}
                title="Clear (use default)"
              >✕</button>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs text-muted-foreground w-20 shrink-0">Background</label>
              <input
                type="color"
                className="w-8 h-6 p-0 border border-border rounded cursor-pointer"
                value={current.background || '#1E1E1E'}
                onChange={(e) => updateTokenStyle(selectedLang, { tokenType: selectedToken, background: e.target.value })}
              />
              <span className="text-[11px] text-muted-foreground font-mono">{current.background || 'none'}</span>
              <button
                className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground text-xs"
                onClick={() => updateTokenStyle(selectedLang, { tokenType: selectedToken, background: '' })}
                title="Clear (transparent)"
              >✕</button>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={current.bold}
                  onChange={(e) => updateTokenStyle(selectedLang, { tokenType: selectedToken, bold: e.target.checked })}
                />
                Bold
              </label>
              <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={current.italic}
                  onChange={(e) => updateTokenStyle(selectedLang, { tokenType: selectedToken, italic: e.target.checked })}
                />
                Italic
              </label>
            </div>

            {/* Live preview swatch */}
            <div className="mt-3 p-3 bg-muted rounded">
              <span
                style={{
                  color: current.foreground || 'var(--text)',
                  background: current.background || 'transparent',
                  fontWeight: current.bold ? 'bold' : 'normal',
                  fontStyle: current.italic ? 'italic' : 'normal',
                  fontFamily: 'monospace',
                  fontSize: 14,
                  padding: '4px 8px',
                  borderRadius: 3
                }}
              >
                {selectedToken} token preview
              </span>
            </div>

            <div className="mt-3">
              <button
                className="text-[11px] text-destructive hover:underline bg-transparent border-none cursor-pointer"
                onClick={() => {
                  setStylesMap((prev) => {
                    const next = { ...prev }
                    delete next[selectedLang]
                    return next
                  })
                }}
              >
                Reset {LANGUAGES.find((l) => l.id === selectedLang)?.label} to defaults
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-border">
          <button
            className="px-3 py-1.5 text-xs border border-border rounded bg-secondary text-foreground cursor-pointer hover:bg-muted transition-colors"
            onClick={handleImport}
            title="Import Notepad++ theme (future feature)"
          >Import Theme</button>
          {saved && <span className="text-green-500 text-[11px] mr-2">Saved & Applied!</span>}
          <button
            className="px-3 py-1.5 text-xs border-none rounded bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors"
            onClick={handleSave}
          >Save & Apply</button>
          <button
            className="px-3 py-1.5 text-xs border border-border rounded bg-secondary text-foreground cursor-pointer hover:bg-muted transition-colors"
            onClick={() => setShowStyleConfigurator(false)}
          >Close</button>
        </div>
      </div>
    </div>
  )
}
