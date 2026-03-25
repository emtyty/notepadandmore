import React from 'react'
import { useUIStore } from '../../store/uiStore'
import { FileBrowserPanel } from '../FileBrowser/FileBrowserPanel'
import { ProjectPanel } from '../ProjectPanel/ProjectPanel'
import { DocumentMapPanel } from '../DocumentMap/DocumentMapPanel'
import { FunctionListPanel } from '../FunctionList/FunctionListPanel'
import styles from './Sidebar.module.css'

type SidebarPanelId = 'files' | 'project' | 'docmap' | 'functions'

const TABS: { id: SidebarPanelId; icon: string; title: string }[] = [
  { id: 'files',     icon: '📁', title: 'File Browser' },
  { id: 'project',   icon: '🗂', title: 'Project' },
  { id: 'docmap',    icon: '🗺', title: 'Document Map' },
  { id: 'functions', icon: 'ƒ',  title: 'Function List' },
]

export function Sidebar() {
  const { sidebarPanel, setSidebarPanel, setShowSidebar } = useUIStore()

  const panels: Record<SidebarPanelId, React.ReactNode> = {
    files:     <FileBrowserPanel />,
    project:   <ProjectPanel />,
    docmap:    <DocumentMapPanel />,
    functions: <FunctionListPanel />,
  }

  return (
    <div className={styles.sidebar}>
      <div className={styles.tabBar}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${styles.tabBtn} ${sidebarPanel === t.id ? styles.tabBtnActive : ''}`}
            title={t.title}
            onClick={() => setSidebarPanel(t.id)}
          >
            {t.icon}
          </button>
        ))}
        <div className={styles.spacer} />
        <button
          className={styles.closeBtn}
          title="Close Sidebar"
          onClick={() => setShowSidebar(false)}
        >
          ✕
        </button>
      </div>
      <div className={styles.panelContent}>
        {panels[sidebarPanel]}
      </div>
    </div>
  )
}
