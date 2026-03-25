import React from 'react'
import { useUIStore } from '../../store/uiStore'
import styles from './ProjectPanel.module.css'

export function ProjectPanel() {
  const { workspaceFolder, setWorkspaceFolder, setSidebarPanel } = useUIStore()

  const handleOpen = async () => {
    const result = await window.api.file.openDirDialog()
    if (!result) return
    setWorkspaceFolder(result)
    setSidebarPanel('files')
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Project</div>
      {workspaceFolder ? (
        <div className={styles.folderRow}>
          <span className={styles.folderIcon}>📁</span>
          <span className={styles.folderName} title={workspaceFolder}>
            {workspaceFolder.replace(/\\/g, '/').split('/').pop() ?? workspaceFolder}
          </span>
          <button className={styles.changeBtn} onClick={handleOpen} title="Change folder">
            …
          </button>
        </div>
      ) : (
        <div className={styles.empty}>
          <button className={styles.openBtn} onClick={handleOpen}>Open Folder…</button>
          <p>No workspace folder open.</p>
        </div>
      )}
    </div>
  )
}
