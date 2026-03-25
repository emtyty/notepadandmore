import React, { useRef, useState, useCallback } from 'react'
import { useEditorStore, Buffer } from '../../store/editorStore'
import styles from './TabBar.module.css'

interface TabBarProps {
  onClose?: (id: string) => void
}

export const TabBar: React.FC<TabBarProps> = ({ onClose }) => {
  const { buffers, activeId, setActive, removeBuffer } = useEditorStore()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null)
  const dragRef = useRef<string | null>(null)
  const dragOverRef = useRef<string | null>(null)

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, id })
  }

  const closeContextMenu = () => setContextMenu(null)

  const handleDragStart = (id: string) => { dragRef.current = id }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    dragOverRef.current = id
  }

  const handleDrop = () => {
    const from = dragRef.current
    const to = dragOverRef.current
    if (!from || !to || from === to) return
    useEditorStore.setState((s) => {
      const bufs = [...s.buffers]
      const fromIdx = bufs.findIndex((b) => b.id === from)
      const toIdx = bufs.findIndex((b) => b.id === to)
      const [removed] = bufs.splice(fromIdx, 1)
      bufs.splice(toIdx, 0, removed)
      return { buffers: bufs }
    })
    dragRef.current = null
    dragOverRef.current = null
  }

  const closeOthers = (id: string) => {
    buffers.filter((b) => b.id !== id).forEach((b) => onClose?.(b.id))
    closeContextMenu()
  }

  const closeAll = () => {
    buffers.forEach((b) => onClose?.(b.id))
    closeContextMenu()
  }

  const copyPath = (id: string) => {
    const buf = buffers.find((b) => b.id === id)
    if (buf?.filePath) navigator.clipboard.writeText(buf.filePath)
    closeContextMenu()
  }

  const revealInExplorer = (id: string) => {
    const buf = buffers.find((b) => b.id === id)
    if (buf?.filePath) window.api.file.reveal(buf.filePath)
    closeContextMenu()
  }

  return (
    <>
      <div className={styles.tabBar} data-testid="tabbar" onClick={closeContextMenu}>
        {buffers.map((buf) => (
          <div
            key={buf.id}
            className={`${styles.tab} ${buf.id === activeId ? styles.active : ''} ${buf.isDirty ? styles.dirty : ''}`}
            onClick={() => setActive(buf.id)}
            onContextMenu={(e) => handleContextMenu(e, buf.id)}
            draggable
            onDragStart={() => handleDragStart(buf.id)}
            onDragOver={(e) => handleDragOver(e, buf.id)}
            onDrop={handleDrop}
            title={buf.filePath ?? buf.title}
            data-tab-title={buf.title}
            data-tab-dirty={buf.isDirty ? 'true' : 'false'}
          >
            <span className={styles.dirtyDot} data-testid="dirty-dot">{buf.isDirty ? '●' : ''}</span>
            <span className={styles.title}>{buf.title}</span>
            <button
              className={styles.closeBtn}
              onClick={(e) => { e.stopPropagation(); onClose?.(buf.id) }}
              title="Close tab"
            >
              ×
            </button>
          </div>
        ))}

        {buffers.length === 0 && (
          <div className={styles.empty}>No files open</div>
        )}
      </div>

      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={closeContextMenu}
        >
          <button onClick={() => { onClose?.(contextMenu.id); closeContextMenu() }}>Close</button>
          <button onClick={() => closeOthers(contextMenu.id)}>Close Others</button>
          <button onClick={closeAll}>Close All</button>
          <hr />
          <button onClick={() => copyPath(contextMenu.id)}>Copy File Path</button>
          <button onClick={() => revealInExplorer(contextMenu.id)}>Reveal in Explorer</button>
        </div>
      )}
    </>
  )
}
