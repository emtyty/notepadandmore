import React from 'react'
import { useUIStore } from '../../store/uiStore'
import { FileBrowserPanel } from '../FileBrowser/FileBrowserPanel'
import { ProjectPanel } from '../ProjectPanel/ProjectPanel'
import { DocumentMapPanel } from '../DocumentMap/DocumentMapPanel'
import { FunctionListPanel } from '../FunctionList/FunctionListPanel'
import { Tooltip } from '../Tooltip/Tooltip'
import styles from './Sidebar.module.css'

type SidebarPanelId = 'files' | 'project' | 'docmap' | 'functions'

const PANEL_TITLES: Record<SidebarPanelId, string> = {
  files:     'File Browser',
  project:   'Project',
  docmap:    'Document Map',
  functions: 'Symbols',
}

export function Sidebar() {
  const { sidebarPanel, setShowSidebar } = useUIStore()

  const panels: Record<SidebarPanelId, React.ReactNode> = {
    files:     <FileBrowserPanel />,
    project:   <ProjectPanel />,
    docmap:    <DocumentMapPanel />,
    functions: <FunctionListPanel />,
  }

  return (
    <div className={styles.sidebar} data-testid="sidebar">
      <div className={styles.header}>
        <span className={styles.headerTitle}>{PANEL_TITLES[sidebarPanel]}</span>
        <Tooltip text="Close Sidebar" side="bottom">
          <button
            className={styles.closeBtn}
            onClick={() => setShowSidebar(false)}
          >
            ✕
          </button>
        </Tooltip>
      </div>
      <div className={styles.panelContent}>
        {panels[sidebarPanel]}
      </div>
    </div>
  )
}
