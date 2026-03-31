import React from 'react'
import { Files, Search, Settings, Puzzle } from 'lucide-react'
import { Tooltip } from '../Tooltip/Tooltip'
import { useUIStore } from '../../store/uiStore'
import styles from './SideNav.module.css'

type SidebarPanelId = 'files' | 'search' | 'plugins'

const NAV_ITEMS: { id: SidebarPanelId; icon: React.ReactNode; label: string; tip: string }[] = [
  { id: 'files',     icon: <Files size={20} />,            label: 'Files',    tip: 'File Browser' },
  { id: 'search',    icon: <Search size={20} />,           label: 'Search',   tip: 'Find & Replace (Ctrl+F)' },
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
    if (id === 'preferences') {
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
      {/* <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <Feather size={20} />
        </div>
      </div> */}

      <div className={styles.navList}>
        {NAV_ITEMS.map((item) => (
          <Tooltip key={item.id} text={item.tip} side="right">
            <button
              type="button"
              className={`${styles.navBtn} ${isActive(item.id) ? styles.active : ''}`}
              onClick={() => handleNav(item.id)}
            >
              {item.icon}
            </button>
          </Tooltip>
        ))}
      </div>

      <div className={styles.navFooter}>
        <Tooltip text="Preferences" side="right">
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => handleNav('preferences')}
          >
            <Settings size={20} />
          </button>
        </Tooltip>
      </div>

    </nav>
  )
}
