import React from 'react'
import {
  Feather, Files, Search, Map, FunctionSquare,
  Settings, Puzzle, Undo2, Redo2
} from 'lucide-react'
import { Tooltip } from '../Tooltip/Tooltip'
import { useUIStore } from '../../store/uiStore'
import styles from './SideNav.module.css'

type SidebarPanelId = 'files' | 'project' | 'docmap' | 'functions'

const NAV_ITEMS: { id: SidebarPanelId | 'search' | 'tools' | 'plugins'; icon: React.ReactNode; label: string; tip: string }[] = [
  { id: 'files',     icon: <Files size={20} />,            label: 'Files',    tip: 'File Browser' },
  { id: 'search',    icon: <Search size={20} />,           label: 'Search',   tip: 'Find & Replace (Ctrl+F)' },
  { id: 'docmap',    icon: <Map size={20} />,              label: 'View',     tip: 'Document Map' },
  { id: 'functions', icon: <FunctionSquare size={20} />,   label: 'Symbols',  tip: 'Function List' },
  { id: 'tools',     icon: <Settings size={20} />,         label: 'Tools',    tip: 'Preferences' },
  { id: 'plugins',   icon: <Puzzle size={20} />,           label: 'Plugins',  tip: 'Plugin Manager' },
]

const PANEL_IDS = new Set<string>(['files', 'project', 'docmap', 'functions'])

export function SideNav() {
  const {
    sidebarPanel,
    showSidebar,
    setSidebarPanel,
    setShowSidebar,
    openFind,
    setShowPreferences,
    setShowPluginManager,
  } = useUIStore()

  const handleNav = (id: string) => {
    if (id === 'search') {
      openFind('find')
      return
    }
    if (id === 'tools') {
      setShowPreferences(true)
      return
    }
    if (id === 'plugins') {
      setShowPluginManager(true)
      return
    }
    if (PANEL_IDS.has(id)) {
      const panelId = id as SidebarPanelId
      if (showSidebar && sidebarPanel === panelId) {
        setShowSidebar(false)
      } else {
        setSidebarPanel(panelId)
        setShowSidebar(true)
      }
    }
  }

  const isActive = (id: string) => {
    if (!PANEL_IDS.has(id)) return false
    return showSidebar && sidebarPanel === id
  }

  return (
    <nav className={styles.sidenav} data-testid="sidenav">
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <Feather size={20} />
        </div>
      </div>

      <div className={styles.navList}>
        {NAV_ITEMS.map((item) => (
          <Tooltip key={item.id} text={item.tip} side="right">
            <button
              className={`${styles.navBtn} ${isActive(item.id) ? styles.active : ''}`}
              onClick={() => handleNav(item.id)}
            >
              {item.icon}
              <span className={styles.navLabel}>{item.label}</span>
            </button>
          </Tooltip>
        ))}
      </div>

      <div className={styles.bottomActions}>
        <Tooltip text="Undo (Ctrl+Z)" side="right">
          <button
            className={styles.iconBtn}
            onClick={() => window.dispatchEvent(new CustomEvent('editor:undo'))}
          >
            <Undo2 size={18} />
          </button>
        </Tooltip>
        <Tooltip text="Redo (Ctrl+Y)" side="right">
          <button
            className={styles.iconBtn}
            onClick={() => window.dispatchEvent(new CustomEvent('editor:redo'))}
          >
            <Redo2 size={18} />
          </button>
        </Tooltip>
      </div>
    </nav>
  )
}
