import { useEffect } from 'react'
import { X } from 'lucide-react'
import TableLens from './TableLens'
import { useUIStore } from '../../store/uiStore'

interface CsvViewerOverlayProps {
  csvText: string
  fileName: string
}

export function CsvViewerOverlay({ csvText, fileName }: CsvViewerOverlayProps): JSX.Element {
  const closeCsvViewer = useUIStore((s) => s.closeCsvViewer)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeCsvViewer()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeCsvViewer])

  return (
    <div className="absolute inset-0 bg-background z-20 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <span className="text-sm font-medium text-foreground">{fileName || 'Table Lens'}</span>
        <button
          onClick={closeCsvViewer}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Close (Esc)"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <TableLens initialCsvText={csvText} initialFileName={fileName} />
      </div>
    </div>
  )
}
