import React, { useEffect, useState } from 'react'
import { FilePlus, FolderOpen, Clock } from 'lucide-react'
import appIcon from '../../assets/app-icon.png'
import { useConfigStore } from '../../store/configStore'
import styles from './WelcomeScreen.module.css'

interface WelcomeScreenProps {
  onNewFile: () => void
  onOpenFile: () => void
  onOpenRecent: (paths: string[]) => void
}

const isMac = navigator.platform.toUpperCase().includes('MAC')
const mod = isMac ? '⌘' : 'Ctrl'

export function WelcomeScreen({ onNewFile, onOpenFile, onOpenRecent }: WelcomeScreenProps) {
  const { maxRecentFiles } = useConfigStore()
  const [recents, setRecents] = useState<string[]>([])

  useEffect(() => {
    window.api.file.getRecents().then((files: string[]) => {
      setRecents(files.slice(0, Math.min(maxRecentFiles, 8)))
    })
  }, [maxRecentFiles])

  return (
    <div className={styles.container}>
      <div className={styles.layout}>
        {/* Left: app icon */}
        <img src={appIcon} alt="Digital Artisan Editor" className={styles.logo} />

        {/* Right: app name + actions */}
        <div className={styles.right}>
          <div className={styles.appName}>Digital Artisan Editor</div>

          <div className={styles.panel}>
            <button className={styles.action} onClick={onNewFile}>
              <span className={styles.actionLabel}>
                <FilePlus size={14} className={styles.actionIcon} />
                New File
              </span>
              <span className={styles.shortcut}>{mod} N</span>
            </button>
            <button className={styles.action} onClick={onOpenFile}>
              <span className={styles.actionLabel}>
                <FolderOpen size={14} className={styles.actionIcon} />
                Open File…
              </span>
              <span className={styles.shortcut}>{mod} O</span>
            </button>

            {recents.length > 0 && (
              <>
                <div className={styles.divider}>
                  <Clock size={11} />
                  <span>Recent</span>
                </div>
                {recents.map((fp) => {
                  const parts = fp.replace(/\\/g, '/').split('/')
                  const name = parts[parts.length - 1]
                  const dir = parts.length > 1 ? parts[parts.length - 2] : ''
                  return (
                    <button key={fp} className={styles.action} onClick={() => onOpenRecent([fp])} title={fp}>
                      <span className={styles.recentLabel}>
                        <span className={styles.recentName}>{name}</span>
                        {dir && <span className={styles.recentDir}>{dir}</span>}
                      </span>
                    </button>
                  )
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
