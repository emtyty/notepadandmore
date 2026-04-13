import { useState, useRef, useEffect } from 'react'
import {
  FilePlus, FolderOpen, Save, X,
  Undo2, Redo2, Scissors, Copy, Clipboard, SquareDashedMousePointer,
  Search, Replace, FolderSearch,
  Sun, Moon, PanelLeftClose, PanelLeft,
  RotateCcw, ChevronRight,
} from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useConfigStore } from '../../store/configStore'
import { useEditorStore } from '../../store/editorStore'

interface MenuBarProps {
  onNew: () => void
  onOpen: () => void
  onOpenFolder: () => void
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
  disabled?: boolean
  checked?: boolean
  submenu?: MenuItem[]
}

const isMac = window.api.platform === 'darwin'
const mod = isMac ? '⌘' : 'Ctrl'

const editorCmd = (cmd: string) => () =>
  window.dispatchEvent(new CustomEvent('editor:command', { detail: cmd }))

export function MenuBar({
  onNew, onOpen, onOpenFolder, onSave, onSaveAs, onSaveAll,
  onClose, onCloseAll, onFind, onReplace, onFindInFiles, onReload,
}: MenuBarProps) {
  // macOS uses native menu — hide custom MenuBar
  if (isMac) return null

  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [hoveredSubmenu, setHoveredSubmenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const {
    theme, showToolbar, showStatusBar, showSidebar,
    wordWrap, renderWhitespace, indentationGuides, columnSelectMode,
    toggleTheme, setShowToolbar, setShowStatusBar, setShowSidebar,
    setWordWrap, setRenderWhitespace, setIndentationGuides, setColumnSelectMode,
  } = useUIStore()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null)
        setHoveredSubmenu(null)
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
      { label: 'Open Folder...', shortcut: `${mod}+Shift+O`, action: onOpenFolder },
      { label: 'Save', icon: <Save size={14} />, shortcut: `${mod}+S`, action: onSave },
      { label: 'Save As...', shortcut: `${mod}+Shift+S`, action: onSaveAs },
      { label: 'Save All', shortcut: `${mod}+Alt+S`, action: onSaveAll },
      { separator: true, label: '' },
      { label: 'Reload from Disk', icon: <RotateCcw size={14} />, shortcut: `${mod}+R`, action: onReload },
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
      { separator: true, label: '' },
      {
        label: 'Line Operations', submenu: [
          { label: 'Duplicate Line', shortcut: `${mod}+D`, action: editorCmd('duplicateLine') },
          { label: 'Delete Line', shortcut: `${mod}+Shift+K`, action: editorCmd('deleteLine') },
          { label: 'Move Line Up', shortcut: 'Alt+Up', action: editorCmd('moveLineUp') },
          { label: 'Move Line Down', shortcut: 'Alt+Down', action: editorCmd('moveLineDown') },
          { separator: true, label: '' },
          { label: 'Sort Lines Ascending', action: editorCmd('sortLinesAsc') },
          { label: 'Sort Lines Descending', action: editorCmd('sortLinesDesc') },
        ],
      },
      {
        label: 'Convert Case', submenu: [
          { label: 'UPPERCASE', shortcut: `${mod}+Shift+U`, action: editorCmd('toUpperCase') },
          { label: 'lowercase', shortcut: `${mod}+U`, action: editorCmd('toLowerCase') },
          { label: 'Title Case', action: editorCmd('toTitleCase') },
        ],
      },
      { separator: true, label: '' },
      { label: 'Toggle Comment', shortcut: `${mod}+/`, action: editorCmd('toggleComment') },
      { label: 'Toggle Block Comment', shortcut: `${mod}+Shift+/`, action: editorCmd('toggleBlockComment') },
      { separator: true, label: '' },
      { label: 'Trim Trailing Whitespace', action: editorCmd('trimTrailingWhitespace') },
      { label: 'Indent Selection', shortcut: 'Tab', action: editorCmd('indentSelection') },
      { label: 'Outdent Selection', shortcut: 'Shift+Tab', action: editorCmd('outdentSelection') },
    ],
    Search: [
      { label: 'Find...', icon: <Search size={14} />, shortcut: `${mod}+F`, action: onFind },
      { label: 'Replace...', icon: <Replace size={14} />, shortcut: `${mod}+H`, action: onReplace },
      { label: 'Find in Files...', icon: <FolderSearch size={14} />, shortcut: `${mod}+Shift+F`, action: onFindInFiles },
      { separator: true, label: '' },
      { label: 'Go to Line...', shortcut: `${mod}+G`, action: editorCmd('goToLine') },
      { separator: true, label: '' },
      { label: 'Toggle Bookmark', shortcut: `${mod}+F2`, disabled: true },
      { label: 'Next Bookmark', shortcut: 'F2', disabled: true },
      { label: 'Previous Bookmark', shortcut: 'Shift+F2', disabled: true },
      { label: 'Clear All Bookmarks', disabled: true },
    ],
    View: [
      { label: showToolbar ? 'Hide Toolbar' : 'Show Toolbar', action: () => setShowToolbar(!showToolbar) },
      { label: showStatusBar ? 'Hide Status Bar' : 'Show Status Bar', action: () => setShowStatusBar(!showStatusBar) },
      { label: showSidebar ? 'Hide Sidebar' : 'Show Sidebar', icon: showSidebar ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />, shortcut: `${mod}+B`, action: () => setShowSidebar(!showSidebar) },
      { separator: true, label: '' },
      {
        label: 'Word Wrap', shortcut: 'Alt+Z', checked: wordWrap,
        action: () => {
          const v = !wordWrap
          setWordWrap(v)
          window.dispatchEvent(new CustomEvent('editor:set-option-local', { detail: { wordWrap: v ? 'on' : 'off' } }))
        },
      },
      {
        label: 'Show Whitespace', checked: renderWhitespace,
        action: () => {
          const v = !renderWhitespace
          setRenderWhitespace(v)
          window.dispatchEvent(new CustomEvent('editor:set-option-local', { detail: { renderWhitespace: v ? 'all' : 'none' } }))
        },
      },
      {
        label: 'Show Indentation Guides', checked: indentationGuides,
        action: () => {
          const v = !indentationGuides
          setIndentationGuides(v)
          window.dispatchEvent(new CustomEvent('editor:set-option-local', { detail: { guides: { indentation: v } } }))
        },
      },
      {
        label: 'Column Select Mode', checked: columnSelectMode,
        action: () => {
          const v = !columnSelectMode
          setColumnSelectMode(v)
          window.dispatchEvent(new CustomEvent('editor:set-option-local', { detail: { columnSelection: v } }))
        },
      },
      { separator: true, label: '' },
      { label: 'Zoom In', shortcut: `${mod}+=`, action: editorCmd('zoomIn') },
      { label: 'Zoom Out', shortcut: `${mod}+-`, action: editorCmd('zoomOut') },
      { label: 'Reset Zoom', shortcut: `${mod}+0`, action: editorCmd('zoomReset') },
      { separator: true, label: '' },
      { label: 'Split View', disabled: true },
    ],
    Settings: [
      { label: 'Settings', shortcut: `${mod}+,`, action: () => useEditorStore.getState().openVirtualTab('settings') },
      { label: 'Shortcut Mapper...', disabled: true },
      { separator: true, label: '' },
      { label: 'User Defined Languages...', disabled: true },
      { label: 'Style Configurator...', disabled: true },
      { separator: true, label: '' },
      { label: theme === 'dark' ? 'Light Mode' : 'Dark Mode', icon: theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />, action: handleThemeToggle },
    ],
    Macro: [
      { label: 'Start Recording', shortcut: `${mod}+Shift+R`, disabled: true },
      { label: 'Stop Recording', shortcut: `${mod}+Shift+R`, disabled: true },
      { label: 'Playback', shortcut: `${mod}+Shift+P`, disabled: true },
      { separator: true, label: '' },
      { label: 'Saved Macros', disabled: true },
    ],
    Plugins: [
      { label: 'Plugin Manager...', disabled: true },
    ],
    Window: [
      { label: 'Minimize', action: () => window.dispatchEvent(new CustomEvent('window:minimize')) },
      { label: 'Zoom', action: () => window.dispatchEvent(new CustomEvent('window:zoom')) },
      { separator: true, label: '' },
      { label: 'Next Tab', shortcut: `${mod}+Tab`, action: () => window.dispatchEvent(new CustomEvent('tab:next-local')) },
      { label: 'Previous Tab', shortcut: `${mod}+Shift+Tab`, action: () => window.dispatchEvent(new CustomEvent('tab:prev-local')) },
    ],
    Help: [
      { label: 'About NovaPad', action: () => useUIStore.getState().setShowAbout(true) },
      { separator: true, label: '' },
      { label: 'Open DevTools', shortcut: 'F12', action: () => window.dispatchEvent(new CustomEvent('dev:toggle-devtools')) },
    ],
  }

  const topMenus = ['File', 'Edit', 'Search', 'View', 'Settings', 'Macro', 'Plugins', 'Window', 'Help']

  const renderMenuItems = (items: MenuItem[], parentLabel: string) => (
    items.map((item, i) => {
      if (item.separator) {
        return <div key={`${parentLabel}-sep-${i}`} className="h-px bg-border mx-2 my-1" />
      }
      if (item.submenu) {
        const subKey = `${parentLabel}-${item.label}`
        return (
          <div
            key={item.label}
            className="relative"
            onMouseEnter={() => setHoveredSubmenu(subKey)}
            onMouseLeave={() => setHoveredSubmenu(null)}
          >
            <div className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-popover-foreground hover:bg-secondary transition-colors cursor-default">
              <span className="w-4 flex justify-center">{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              <ChevronRight size={12} className="text-muted-foreground" />
            </div>
            {hoveredSubmenu === subKey && (
              <div className="absolute left-full top-0 ml-0.5 min-w-[200px] bg-popover border border-border rounded-md shadow-lg py-1 z-50">
                {renderMenuItems(item.submenu, subKey)}
              </div>
            )}
          </div>
        )
      }
      return (
        <button
          key={item.label}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-popover-foreground transition-colors ${
            item.disabled ? 'opacity-40 pointer-events-none' : 'hover:bg-secondary'
          }`}
          disabled={item.disabled}
          onClick={() => {
            if (!item.disabled) {
              item.action?.()
              setActiveMenu(null)
              setHoveredSubmenu(null)
            }
          }}
        >
          <span className="w-4 flex justify-center">
            {item.checked !== undefined ? (
              <span className="text-[11px]">{item.checked ? '✓' : ''}</span>
            ) : (
              item.icon
            )}
          </span>
          <span className="flex-1 text-left">{item.label}</span>
          {item.shortcut && (
            <span className="text-[10px] text-muted-foreground ml-4">{item.shortcut}</span>
          )}
        </button>
      )
    })
  )

  return (
    <div
      ref={menuRef}
      className="h-8 bg-toolbar border-b border-toolbar-border flex items-center px-1 select-none shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      data-testid="menubar"
    >
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
              onClick={() => {
                setActiveMenu(activeMenu === label ? null : label)
                setHoveredSubmenu(null)
              }}
            >
              {label}
            </button>

            {/* Dropdown */}
            {activeMenu === label && menuItems[label] && (
              <div className="absolute top-full left-0 mt-0.5 min-w-[220px] max-h-[80vh] overflow-y-auto bg-popover border border-border rounded-md shadow-lg py-1 z-50">
                {renderMenuItems(menuItems[label], label)}
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
