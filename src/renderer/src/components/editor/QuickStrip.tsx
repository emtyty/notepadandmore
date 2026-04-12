import { Search, PanelLeftClose, PanelLeft, Sun, Moon } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useConfigStore } from '../../store/configStore'

interface QuickStripProps {
  onFind: () => void
  onToggleSidebar: () => void
  onToggleTheme: () => void
}

export function QuickStrip({ onFind, onToggleSidebar, onToggleTheme }: QuickStripProps) {
  const { theme, showSidebar } = useUIStore()

  return (
    <div
      className="h-12 bg-toolbar border-b border-toolbar-border flex items-center px-1 select-none shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      data-testid="quickstrip"
    >
      {/* macOS traffic light spacer */}
      <div className="w-[78px] h-full shrink-0" />

      {/* App icon */}
      <div className="flex items-center gap-1.5 px-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div className="w-4 h-4 rounded-sm bg-primary flex items-center justify-center">
          <span className="text-primary-foreground text-[8px] font-bold font-mono">N+</span>
        </div>
        <span className="text-xs font-semibold text-toolbar-foreground tracking-tight">NovaPad</span>
      </div>

      <div className="flex-1" />

      {/* Quick action icons */}
      <div className="flex items-center gap-0.5 mr-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={onFind}
          className="p-1.5 text-toolbar-foreground hover:bg-secondary rounded-sm transition-colors"
          title="Find"
          data-testid="quickstrip-find"
        >
          <Search size={14} />
        </button>
        <button
          onClick={onToggleSidebar}
          className="p-1.5 text-toolbar-foreground hover:bg-secondary rounded-sm transition-colors"
          title={showSidebar ? 'Hide Explorer' : 'Show Explorer'}
          data-testid="quickstrip-sidebar"
        >
          {showSidebar ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />}
        </button>
        <button
          onClick={onToggleTheme}
          className="p-1.5 text-toolbar-foreground hover:bg-secondary rounded-sm transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          data-testid="quickstrip-theme"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </div>
  )
}
