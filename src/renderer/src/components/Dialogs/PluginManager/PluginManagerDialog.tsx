import React, { useEffect, useRef, useState } from 'react'
import { useUIStore } from '../../../store/uiStore'
import { usePluginStore, PluginInfo } from '../../../store/pluginStore'
import { cn } from '../../../lib/utils'

export function PluginManagerDialog() {
  const { showPluginManager, setShowPluginManager } = useUIStore()
  const { plugins, fetchPlugins } = usePluginStore()
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [reloading, setReloading] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef<{ mx: number; my: number; dx: number; dy: number } | null>(null)

  useEffect(() => {
    if (showPluginManager) fetchPlugins()
  }, [showPluginManager]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showPluginManager) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowPluginManager(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showPluginManager, setShowPluginManager])

  const onMouseDown = (e: React.MouseEvent) => {
    const rect = dialogRef.current?.getBoundingClientRect()
    if (!rect) return
    dragStart.current = { mx: e.clientX, my: e.clientY, dx: rect.left, dy: rect.top }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const onMouseMove = (e: MouseEvent) => {
    if (!dragStart.current) return
    const { mx, my, dx, dy } = dragStart.current
    setPos({ x: dx + e.clientX - mx, y: dy + e.clientY - my })
  }

  const onMouseUp = () => {
    dragStart.current = null
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  const handleReload = async () => {
    setReloading(true)
    await window.api.plugin.reload()
    await fetchPlugins()
    setReloading(false)
  }

  if (!showPluginManager) return null

  const dialogStyle: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, transform: 'none' }
    : {}

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50">
      <div
        ref={dialogRef}
        className="fixed z-[9001] bg-popover border border-border rounded-lg shadow-2xl min-w-[480px] max-w-[90vw] max-h-[85vh] flex flex-col"
        style={dialogStyle}
        data-testid="plugin-manager-dialog"
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border cursor-move select-none" onMouseDown={onMouseDown}>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plugin Manager</span>
          <button
            className="bg-transparent border-none cursor-pointer text-muted-foreground text-sm w-6 h-6 flex items-center justify-center rounded hover:bg-secondary hover:text-foreground"
            data-testid="plugin-manager-close"
            onClick={() => setShowPluginManager(false)}
          >✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 editor-scrollbar">
          {plugins.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm" data-testid="plugin-manager-empty">
              <p>No plugins installed.</p>
              <p className="mt-2">
                Place plugins in <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">~/.config/notepad-and-more/plugins/</code>
              </p>
            </div>
          ) : (
            <table className="w-full text-xs border-collapse" data-testid="plugin-manager-table">
              <thead>
                <tr>
                  <th className="text-left p-2 border-b border-border text-muted-foreground font-medium text-[11px] uppercase">Name</th>
                  <th className="text-left p-2 border-b border-border text-muted-foreground font-medium text-[11px] uppercase">Version</th>
                  <th className="text-left p-2 border-b border-border text-muted-foreground font-medium text-[11px] uppercase">Author</th>
                  <th className="text-left p-2 border-b border-border text-muted-foreground font-medium text-[11px] uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {plugins.map((p: PluginInfo) => (
                  <tr key={p.name} className="hover:bg-secondary/50">
                    <td className="p-2 border-b border-border">
                      <span className="font-medium">{p.name}</span>
                      {p.description && <span className="block text-[11px] text-muted-foreground mt-0.5">{p.description}</span>}
                    </td>
                    <td className="p-2 border-b border-border">{p.version}</td>
                    <td className="p-2 border-b border-border">{p.author ?? '—'}</td>
                    <td className="p-2 border-b border-border">
                      {p.error
                        ? <span className="text-destructive text-[11px] font-medium" title={p.error}>Error</span>
                        : p.enabled
                          ? <span className="text-green-500 text-[11px] font-medium">Active</span>
                          : <span className="text-muted-foreground text-[11px]">Disabled</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-border">
          <button
            className="px-3 py-1.5 text-xs border border-border rounded bg-secondary text-foreground cursor-pointer hover:bg-muted transition-colors"
            onClick={handleReload}
            disabled={reloading}
            data-testid="plugin-manager-reload"
          >
            {reloading ? 'Reloading…' : 'Reload Plugins'}
          </button>
          <button
            className="px-3 py-1.5 text-xs border border-border rounded bg-secondary text-foreground cursor-pointer hover:bg-muted transition-colors"
            onClick={() => setShowPluginManager(false)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
