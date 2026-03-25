import React, { useState, useEffect, useCallback } from 'react'
import { useEditorStore, EOLType } from '../../store/editorStore'
import { useUIStore } from '../../store/uiStore'
import styles from './StatusBar.module.css'

const EOL_CYCLE: EOLType[] = ['LF', 'CRLF']
const ENCODING_CYCLE = ['UTF-8', 'UTF-8 BOM', 'UTF-16 LE', 'UTF-16 BE']

export const StatusBar: React.FC = () => {
  const { getActive } = useEditorStore()
  const { isRecording } = useUIStore()
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const buf = getActive()

  useEffect(() => {
    const handler = (e: Event) => {
      const { line, col } = (e as CustomEvent).detail
      setCursor({ line, col })
    }
    window.addEventListener('editor:cursor', handler)
    return () => window.removeEventListener('editor:cursor', handler)
  }, [])

  const cycleEOL = useCallback(() => {
    if (!buf) return
    const current = buf.eol ?? 'LF'
    const idx = EOL_CYCLE.indexOf(current)
    const next = EOL_CYCLE[(idx + 1) % EOL_CYCLE.length]
    window.dispatchEvent(new CustomEvent('editor:set-eol', { detail: next }))
  }, [buf])

  const cycleEncoding = useCallback(() => {
    if (!buf) return
    const current = buf.encoding ?? 'UTF-8'
    const idx = ENCODING_CYCLE.indexOf(current)
    const next = ENCODING_CYCLE[idx >= 0 ? (idx + 1) % ENCODING_CYCLE.length : 0]
    window.dispatchEvent(new CustomEvent('editor:set-encoding', { detail: next }))
  }, [buf])

  return (
    <div className={styles.statusBar} data-testid="statusbar">
      <span className={styles.section} data-testid="cursor-position">
        Ln {cursor.line}, Col {cursor.col}
      </span>
      <span className={styles.divider} />
      <span
        className={`${styles.section} ${styles.clickable}`}
        onClick={cycleEOL}
        title="Click to cycle EOL type"
      >
        {buf?.eol ?? 'LF'}
      </span>
      <span className={styles.divider} />
      <span
        className={`${styles.section} ${styles.clickable}`}
        onClick={cycleEncoding}
        title="Click to cycle encoding"
      >
        {buf?.encoding ?? 'UTF-8'}
      </span>
      <span className={styles.divider} />
      <span className={styles.section}>{buf?.language ?? 'Plain Text'}</span>
      <div className={styles.spacer} />
      {isRecording && (
        <span className={`${styles.section} ${styles.recording}`}>REC</span>
      )}
      <span className={styles.section}>
        {buf?.isDirty ? 'Modified' : buf?.filePath ? 'Saved' : 'New File'}
      </span>
    </div>
  )
}
