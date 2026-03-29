import React, { useEffect } from 'react'
import { useUIStore } from '../../../store/uiStore'
import styles from './AboutDialog.module.css'

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
    <div className={styles.overlay} onClick={() => setShowAbout(false)}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.titleBar}>
          <span className={styles.titleText}>About</span>
          <button className={styles.closeBtn} onClick={() => setShowAbout(false)} title="Close">✕</button>
        </div>
        <div className={styles.body}>
          <div className={styles.appName}>Digital Artisan Editor</div>
          <div className={styles.version}>Version {version}</div>
          <p className={styles.description}>
            A cross-platform text editor with full Notepad++ feature parity,
            built on Electron + React + Monaco Editor.
          </p>
          <div className={styles.stack}>
            <div className={styles.stackTitle}>Built with</div>
            <div className={styles.stackList}>
              <span>Electron</span>
              <span>React 18</span>
              <span>TypeScript</span>
              <span>Monaco Editor</span>
              <span>Zustand</span>
              <span>Vite</span>
            </div>
          </div>
          <div className={styles.license}>License: MIT</div>
        </div>
        <div className={styles.footer}>
          <button className={styles.okBtn} onClick={() => setShowAbout(false)}>OK</button>
        </div>
      </div>
    </div>
  )
}
