import { useState, useRef, useEffect } from 'react'
import {
  FilePlus, FolderOpen, Save, X,
  Undo2, Redo2, Scissors, Copy, Clipboard, SquareDashedMousePointer,
  Search, Replace, FolderSearch,
  Sun, Moon, PanelLeftClose, PanelLeft,
  Eye, EyeOff, RotateCcw,
} from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useConfigStore } from '../../store/configStore'

interface MenuBarProps {
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
  onSaveAll: () => void
  onClose: () => void
  onCloseAll: () => void
  onFind: () => void
  onReplace: () => void
  onFindInFiles: () => void
  onReload: () => void
}

interface MenuItem {
  label: string
  icon?: React.ReactNode
  shortcut?: string
  action?: () => void
  separator?: boolean
}

const isMac = window.api.platform === 'darwin'
const mod = isMac ? '⌘' : 'Ctrl'

export function MenuBar({
  onNew, onOpen, onSave, onSaveAs, onSaveAll,
  onClose, onCloseAll, onFind, onReplace, onFindInFiles, onReload,
}: MenuBarProps) {
  // macOS uses native menu — hide custom MenuBar
  if (isMac) return null
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const { theme, showToolbar, showStatusBar, showSidebar, toggleTheme, setShowToolbar, setShowStatusBar, setShowSidebar } = useUIStore()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleThemeToggle = () => {
    toggleTheme()
    useConfigStore.getState().setProp('theme', useUIStore.getState().theme)
  }

  const menuItems: Record<string, MenuItem[]> = {
    File: [
      { label: 'New File', icon: <FilePlus size={14} />, shortcut: `${mod}+N`, action: onNew },
      { label: 'Open File...', icon: <FolderOpen size={14} />, shortcut: `${mod}+O`, action: onOpen },
      { label: 'Save', icon: <Save size={14} />, shortcut: `${mod}+S`, action: onSave },
      { label: 'Save As...', shortcut: `${mod}+Shift+S`, action: onSaveAs },
      { label: 'Save All', shortcut: `${mod}+Alt+S`, action: onSaveAll },
      { separator: true, label: '' },
      { label: 'Reload from Disk', icon: <RotateCcw size={14} />, action: onReload },
      { separator: true, label: '' },
      { label: 'Close File', icon: <X size={14} />, shortcut: `${mod}+W`, action: onClose },
      { label: 'Close All Files', action: onCloseAll },
    ],
    Edit: [
      { label: 'Undo', icon: <Undo2 size={14} />, shortcut: `${mod}+Z`, action: () => window.dispatchEvent(new CustomEvent('editor:undo')) },
      { label: 'Redo', icon: <Redo2 size={14} />, shortcut: `${mod}+Y`, action: () => window.dispatchEvent(new CustomEvent('editor:redo')) },
      { separator: true, label: '' },
      { label: 'Cut', icon: <Scissors size={14} />, shortcut: `${mod}+X`, action: () => document.execCommand('cut') },
      { label: 'Copy', icon: <Copy size={14} />, shortcut: `${mod}+C`, action: () => document.execCommand('copy') },
      { label: 'Paste', icon: <Clipboard size={14} />, shortcut: `${mod}+V`, action: () => document.execCommand('paste') },
      { separator: true, label: '' },
      { label: 'Select All', icon: <SquareDashedMousePointer size={14} />, shortcut: `${mod}+A`, action: () => document.execCommand('selectAll') },
    ],
    Search: [
      { label: 'Find...', icon: <Search size={14} />, shortcut: `${mod}+F`, action: onFind },
      { label: 'Replace...', icon: <Replace size={14} />, shortcut: `${mod}+H`, action: onReplace },
      { separator: true, label: '' },
      { label: 'Find in Files', icon: <FolderSearch size={14} />, shortcut: `${mod}+Shift+F`, action: onFindInFiles },
    ],
    View: [
      { label: showToolbar ? 'Hide Toolbar' : 'Show Toolbar', action: () => setShowToolbar(!showToolbar) },
      { label: showStatusBar ? 'Hide Status Bar' : 'Show Status Bar', action: () => setShowStatusBar(!showStatusBar) },
      { label: showSidebar ? 'Hide Sidebar' : 'Show Sidebar', icon: showSidebar ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />, shortcut: `${mod}+B`, action: () => setShowSidebar(!showSidebar) },
      { separator: true, label: '' },
      { label: theme === 'dark' ? 'Light Mode' : 'Dark Mode', icon: theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />, action: handleThemeToggle },
    ],
  }

  const topMenus = ['File', 'Edit', 'Search', 'View']

  return (
    <div
      ref={menuRef}
      className="h-8 bg-toolbar border-b border-toolbar-border flex items-center px-1 select-none shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      data-testid="menubar"
    >
      {/* macOS traffic light spacer */}
      {isMac && <div className="w-[78px] h-full shrink-0" />}

      {/* App icon */}
      <div className="flex items-center gap-1.5 px-2 mr-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div className="w-4 h-4 rounded-sm bg-primary flex items-center justify-center">
          <span className="text-primary-foreground text-[8px] font-bold font-mono">N+</span>
        </div>
        <span className="text-xs font-semibold text-toolbar-foreground tracking-tight">NovaPad</span>
      </div>

      {/* Menu items */}
      <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {topMenus.map((label) => (
          <div key={label} className="relative">
            <button
              className={`px-2.5 py-1 text-[11px] text-toolbar-foreground hover:bg-secondary rounded-sm transition-colors ${
                activeMenu === label ? 'bg-secondary' : ''
              }`}
              onMouseEnter={() => activeMenu && setActiveMenu(label)}
              onClick={() => setActiveMenu(activeMenu === label ? null : label)}
            >
              {label}
            </button>

            {/* Dropdown */}
            {activeMenu === label && menuItems[label] && (
              <div className="absolute top-full left-0 mt-0.5 min-w-[220px] bg-popover border border-border rounded-md shadow-lg py-1 z-50">
                {menuItems[label].map((item, i) =>
                  item.separator ? (
                    <div key={i} className="h-px bg-border mx-2 my-1" />
                  ) : (
                    <button
                      key={item.label}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-popover-foreground hover:bg-secondary transition-colors"
                      onClick={() => {
                        item.action?.()
                        setActiveMenu(null)
                      }}
                    >
                      <span className="w-4 flex justify-center">{item.icon}</span>
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.shortcut && (
                        <span className="text-[10px] text-muted-foreground ml-4">{item.shortcut}</span>
                      )}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex-1" />

      {/* Right-side quick icons */}
      <div className="flex items-center gap-0.5 mr-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={onFind}
          className="p-1.5 text-toolbar-foreground hover:bg-secondary rounded-sm transition-colors"
          title="Find (Ctrl+F)"
        >
          <Search size={14} />
        </button>
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="p-1.5 text-toolbar-foreground hover:bg-secondary rounded-sm transition-colors"
          title={showSidebar ? 'Hide Explorer' : 'Show Explorer'}
        >
          {showSidebar ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />}
        </button>
        <button
          onClick={handleThemeToggle}
          className="p-1.5 text-toolbar-foreground hover:bg-secondary rounded-sm transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </div>
  )
}
