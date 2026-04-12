import React, { useEffect, useState } from 'react'
import { FilePlus, FolderOpen, Clock } from 'lucide-react'
import { useConfigStore } from '../../store/configStore'

interface WelcomeScreenProps {
  onNewFile: () => void
  onOpenFile: () => void
  onOpenRecent: (paths: string[]) => void
}

const isMac = navigator.platform.toUpperCase().includes('MAC')
const mod = isMac ? '⌘' : 'Ctrl'

export function WelcomeScreen({ onNewFile, onOpenFile, onOpenRecent }: WelcomeScreenProps) {
  const { maxRecentFiles } = useConfigStore()
  const [recents, setRecents] = useState<string[]>([])

  useEffect(() => {
    window.api.file.getRecents().then((files: string[]) => {
      setRecents(files.slice(0, Math.min(maxRecentFiles, 8)))
    })
  }, [maxRecentFiles])

  return (
    <div className="flex justify-center w-full h-full bg-background pt-[10%]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 mx-auto rounded-xl bg-muted flex items-center justify-center">
          <span className="text-2xl font-bold font-mono text-muted-foreground">N+</span>
        </div>

        <div className="min-w-[300px] border border-border rounded-lg overflow-hidden bg-card">
            <button
              className="flex items-center justify-between w-full px-3 py-2.5 text-xs text-foreground bg-transparent border-none cursor-pointer hover:bg-secondary transition-colors"
              onClick={onNewFile}
            >
              <span className="flex items-center gap-2">
                <FilePlus size={14} className="text-muted-foreground" />
                New File
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">{mod} N</span>
            </button>
            <button
              className="flex items-center justify-between w-full px-3 py-2.5 text-xs text-foreground bg-transparent border-none cursor-pointer hover:bg-secondary transition-colors border-t border-border"
              onClick={onOpenFile}
            >
              <span className="flex items-center gap-2">
                <FolderOpen size={14} className="text-muted-foreground" />
                Open File…
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">{mod} O</span>
            </button>

            {recents.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground border-t border-border">
                  <Clock size={11} />
                  <span>Recent</span>
                </div>
                {recents.map((fp) => {
                  const parts = fp.replace(/\\/g, '/').split('/')
                  const name = parts[parts.length - 1]
                  const dir = parts.length > 1 ? parts[parts.length - 2] : ''
                  return (
                    <button
                      key={fp}
                      className="flex items-center w-full px-3 py-1.5 text-xs text-foreground bg-transparent border-none cursor-pointer hover:bg-secondary transition-colors"
                      onClick={() => onOpenRecent([fp])}
                      title={fp}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{name}</span>
                        {dir && <span className="text-[11px] text-muted-foreground truncate">{dir}</span>}
                      </span>
                    </button>
                  )
                })}
              </>
            )}
        </div>
      </div>
    </div>
  )
}
