import React, { useRef } from 'react'
import {
  FilePlus, FolderOpen, Save, Files,
  Printer, X, Search
} from 'lucide-react'
import { Tooltip } from '../Tooltip/Tooltip'
import styles from './TopAppBar.module.css'

interface TopAppBarProps {
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onSaveAll: () => void
  onFind: () => void
  onClose: () => void
}

const isMac = window.api.platform === 'darwin'

const Btn: React.FC<{ tip: string; onClick: () => void; children: React.ReactNode }> = ({ tip, onClick, children }) => (
  <Tooltip text={tip}>
    <button className={styles.btn} onClick={onClick}>
      {children}
    </button>
  </Tooltip>
)

export const TopAppBar: React.FC<TopAppBarProps> = ({
  onNew, onOpen, onSave, onSaveAll, onFind, onClose
}) => {
  const searchRef = useRef<HTMLInputElement>(null)

  const handleSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onFind()
      searchRef.current?.blur()
    }
    if (e.key === 'Escape') {
      searchRef.current?.blur()
    }
  }

  return (
    <header className={styles.topbar} data-testid="topbar">
      {isMac && <div className={styles.trafficSpacer} />}

      <div className={styles.brand}>
        <span className={styles.brandName}>Notepad &amp; More</span>
      </div>

      <div className={styles.actions}>
        <Btn tip="New (Ctrl+N)" onClick={onNew}><FilePlus size={18} /></Btn>
        <Btn tip="Open (Ctrl+O)" onClick={onOpen}><FolderOpen size={18} /></Btn>
        <Btn tip="Save (Ctrl+S)" onClick={onSave}><Save size={18} /></Btn>
        <Btn tip="Save All (Ctrl+Alt+S)" onClick={onSaveAll}><Files size={18} /></Btn>
        <div className={styles.divider} />
        <Btn tip="Print" onClick={() => {}}><Printer size={18} /></Btn>
        <Btn tip="Close tab (Ctrl+W)" onClick={onClose}><X size={18} /></Btn>
      </div>

      <div className={styles.spacer} />

      <div className={styles.searchWrap}>
        <div className={styles.searchInput} onClick={() => searchRef.current?.focus()}>
          <Search size={14} className={styles.searchIcon} />
          <input
            ref={searchRef}
            type="text"
            placeholder="Quick search..."
            onKeyDown={handleSearchKey}
          />
        </div>
      </div>
    </header>
  )
}
