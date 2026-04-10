import React from 'react'
import { X } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import { useUIStore, BottomPanelId } from '../../store/uiStore'
import { FindResultsPanel } from './FindResults/FindResultsPanel'
import { cn } from '../../lib/utils'

interface PanelDef {
  id: BottomPanelId
  label: string
  component: React.ReactNode
}

export function BottomPanelContainer() {
  const { activeBottomPanel, setActiveBottomPanel, setShowBottomPanel } = useUIStore()

  const panels: PanelDef[] = [
    { id: 'findResults', label: 'Find Results', component: <FindResultsPanel /> },
  ]

  const active = panels.find((p) => p.id === activeBottomPanel) ?? panels[0]

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background" data-testid="bottom-panel">
      <div className="flex items-center bg-explorer border-b border-border shrink-0 pl-1">
        {panels.map((p) => (
          <button
            key={p.id}
            className={cn(
              'px-3.5 py-1.5 text-[11px] font-medium cursor-pointer border-none bg-transparent text-muted-foreground border-b-2 border-transparent -mb-px whitespace-nowrap uppercase tracking-wider transition-colors',
              'hover:text-foreground hover:bg-secondary',
              active.id === p.id && 'text-primary border-b-primary'
            )}
            onClick={() => setActiveBottomPanel(p.id)}
          >
            {p.label}
          </button>
        ))}
        <div className="flex-1" />
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="bg-transparent border-none cursor-pointer text-muted-foreground text-sm p-1 px-2 rounded mr-1 hover:bg-secondary hover:text-foreground transition-colors"
                onClick={() => setShowBottomPanel(false)}
              >
                <X size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Close panel</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        {active.component}
      </div>
    </div>
  )
}
