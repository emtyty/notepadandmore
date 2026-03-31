import React, { useRef } from 'react'
import { Undo2, Redo2, Search } from 'lucide-react'
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

export const TopAppBar: React.FC<TopAppBarProps> = ({ onFind }) => {
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

      {/* Undo / Redo */}
      <div className={styles.actions}>
        <Tooltip text="Undo (Ctrl+Z)">
          <button className={styles.btn} onClick={() => window.dispatchEvent(new CustomEvent('editor:undo'))}>
            <Undo2 size={15} />
          </button>
        </Tooltip>
        <Tooltip text="Redo (Ctrl+Y)">
          <button className={styles.btn} onClick={() => window.dispatchEvent(new CustomEvent('editor:redo'))}>
            <Redo2 size={15} />
          </button>
        </Tooltip>
      </div>

      <div className={styles.spacer} />

      {/* Centered search */}
      <div className={styles.searchWrap}>
        <div className={styles.searchInput} onClick={() => searchRef.current?.focus()}>
          <Search size={13} className={styles.searchIcon} />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search"
            onKeyDown={handleSearchKey}
          />
        </div>
      </div>

      <div className={styles.spacer} />
    </header>
  )
}
