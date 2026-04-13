import React from 'react'
import { X } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import { useUIStore } from '../../store/uiStore'
import { FileBrowserPanel } from '../FileBrowser/FileBrowserPanel'
import { ProjectPanel } from '../ProjectPanel/ProjectPanel'
import { DocumentMapPanel } from '../DocumentMap/DocumentMapPanel'
import { FunctionListPanel } from '../FunctionList/FunctionListPanel'

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
    <div className="flex flex-col h-full bg-explorer overflow-hidden" data-testid="sidebar">
      <div className="flex items-center h-9 px-3 border-b border-border shrink-0">
        <span className="flex-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {PANEL_TITLES[sidebarPanel]}
        </span>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                onClick={() => setShowSidebar(false)}
              >
                <X size={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Close Sidebar</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        {panels[sidebarPanel]}
      </div>
    </div>
  )
}
