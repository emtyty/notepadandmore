import React, { useEffect } from 'react'
import { useUIStore } from '../../../store/uiStore'

export function AboutDialog() {
  const { showAbout, setShowAbout } = useUIStore()

  useEffect(() => {
    if (!showAbout) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowAbout(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showAbout, setShowAbout])

  if (!showAbout) return null

  const version = (window.api as { appVersion?: string }).appVersion ?? '1.0.0'

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50" onClick={() => setShowAbout(false)}>
      <div
        className="fixed z-[9001] bg-popover border border-border rounded-lg shadow-2xl min-w-[480px] max-w-[90vw] max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border cursor-move select-none">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">About</span>
          <button
            className="bg-transparent border-none cursor-pointer text-muted-foreground text-sm w-6 h-6 flex items-center justify-center rounded hover:bg-secondary hover:text-foreground"
            onClick={() => setShowAbout(false)}
            title="Close"
          >✕</button>
        </div>
        <div className="px-6 py-4 text-center">
          <div className="text-lg font-semibold text-foreground">Digital Artisan Editor</div>
          <div className="text-sm text-muted-foreground mt-1">Version {version}</div>
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
            A cross-platform text editor with full Notepad++ feature parity,
            built on Electron + React + Monaco Editor.
          </p>
          <div className="mt-4">
            <div className="text-[11px] uppercase text-muted-foreground font-semibold tracking-wider mb-2">Built with</div>
            <div className="flex flex-wrap gap-2 justify-center">
              <span className="text-[11px] bg-secondary px-2 py-1 rounded text-foreground">Electron</span>
              <span className="text-[11px] bg-secondary px-2 py-1 rounded text-foreground">React 18</span>
              <span className="text-[11px] bg-secondary px-2 py-1 rounded text-foreground">TypeScript</span>
              <span className="text-[11px] bg-secondary px-2 py-1 rounded text-foreground">Monaco Editor</span>
              <span className="text-[11px] bg-secondary px-2 py-1 rounded text-foreground">Zustand</span>
              <span className="text-[11px] bg-secondary px-2 py-1 rounded text-foreground">Vite</span>
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground mt-3">License: MIT</div>
        </div>
        <div className="flex items-center justify-center gap-2 px-3 py-2 border-t border-border">
          <button
            className="px-3 py-1.5 text-xs border-none rounded bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors"
            onClick={() => setShowAbout(false)}
          >OK</button>
        </div>
      </div>
    </div>
  )
}
