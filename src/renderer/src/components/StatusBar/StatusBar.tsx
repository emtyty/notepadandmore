import React, { useState, useEffect } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useUIStore } from '../../store/uiStore'
import styles from './StatusBar.module.css'

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

  return (
    <div className={styles.statusBar}>
      <span className={styles.section}>
        Ln {cursor.line}, Col {cursor.col}
      </span>
      <span className={styles.divider} />
      <span className={styles.section}>{buf?.eol ?? 'LF'}</span>
      <span className={styles.divider} />
      <span className={styles.section}>{buf?.encoding ?? 'UTF-8'}</span>
      <span className={styles.divider} />
      <span className={styles.section}>{buf?.language ?? 'Plain Text'}</span>
      <div className={styles.spacer} />
      {isRecording && (
        <>
          <span className={styles.section} style={{ color: '#e74c3c', fontWeight: 600 }}>REC</span>
          <span className={styles.divider} />
        </>
      )}
      <span className={styles.section}>
        {buf?.isDirty ? 'Modified' : buf?.filePath ? 'Saved' : 'New File'}
      </span>
    </div>
  )
}
