import React, { useEffect, useRef, useState } from 'react'
import { useUIStore } from '../../../store/uiStore'
import { usePluginStore, PluginInfo } from '../../../store/pluginStore'
import styles from './PluginManagerDialog.module.css'

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
    ? { left: pos.x, top: pos.y }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }

  return (
    <div className={styles.overlay}>
      <div ref={dialogRef} className={styles.dialog} style={dialogStyle} data-testid="plugin-manager-dialog">
        <div className={styles.titleBar} onMouseDown={onMouseDown}>
          <span className={styles.titleText}>Plugin Manager</span>
          <button className={styles.closeBtn} data-testid="plugin-manager-close" onClick={() => setShowPluginManager(false)}>✕</button>
        </div>

        <div className={styles.content}>
          {plugins.length === 0 ? (
            <div className={styles.empty} data-testid="plugin-manager-empty">
              <p>No plugins installed.</p>
              <p className={styles.emptyHint}>
                Place plugins in <code>~/.config/notepad-and-more/plugins/</code>
              </p>
            </div>
          ) : (
            <table className={styles.table} data-testid="plugin-manager-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Version</th>
                  <th>Author</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {plugins.map((p: PluginInfo) => (
                  <tr key={p.name}>
                    <td>
                      <span className={styles.pluginName}>{p.name}</span>
                      {p.description && <span className={styles.pluginDesc}>{p.description}</span>}
                    </td>
                    <td>{p.version}</td>
                    <td>{p.author ?? '—'}</td>
                    <td>
                      {p.error
                        ? <span className={styles.statusError} title={p.error}>Error</span>
                        : p.enabled
                          ? <span className={styles.statusOk}>Active</span>
                          : <span className={styles.statusDisabled}>Disabled</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={styles.footer}>
          <button
            className={styles.btn}
            onClick={handleReload}
            disabled={reloading}
            data-testid="plugin-manager-reload"
          >
            {reloading ? 'Reloading…' : 'Reload Plugins'}
          </button>
          <button className={styles.btn} onClick={() => setShowPluginManager(false)}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
