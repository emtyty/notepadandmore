import React from 'react'
import { useUIStore, BottomPanelId } from '../../store/uiStore'
import { FindResultsPanel } from './FindResults/FindResultsPanel'
import styles from './BottomPanelContainer.module.css'

interface PanelDef {
  id: BottomPanelId
  label: string
  component: React.ReactNode
}

export function BottomPanelContainer() {
  const { activeBottomPanel, setActiveBottomPanel, setShowBottomPanel } = useUIStore()

  const panels: PanelDef[] = [
    { id: 'findResults', label: 'Find Results', component: <FindResultsPanel /> },
    // Future panels can be added here:
    // { id: 'console', label: 'Console', component: <ConsolePanel /> },
  ]

  const active = panels.find((p) => p.id === activeBottomPanel) ?? panels[0]

  return (
    <div className={styles.container}>
      <div className={styles.tabBar}>
        {panels.map((p) => (
          <button
            key={p.id}
            className={`${styles.tab} ${active.id === p.id ? styles.tabActive : ''}`}
            onClick={() => setActiveBottomPanel(p.id)}
          >
            {p.label}
          </button>
        ))}
        <div className={styles.spacer} />
        <button
          className={styles.closeBtn}
          onClick={() => setShowBottomPanel(false)}
          title="Close panel"
        >
          ✕
        </button>
      </div>
      <div className={styles.content}>
        {active.component}
      </div>
    </div>
  )
}
