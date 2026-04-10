import React from 'react'
import { useUIStore } from '../../store/uiStore'

export function ProjectPanel() {
  const { workspaceFolder, setWorkspaceFolder, setSidebarPanel } = useUIStore()

  const handleOpen = async () => {
    const result = await window.api.file.openDirDialog()
    if (!result) return
    setWorkspaceFolder(result)
    setSidebarPanel('files')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden text-foreground">
      {workspaceFolder ? (
        <div className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] min-w-0">
          <span className="shrink-0 text-sm">📁</span>
          <span className="flex-1 truncate font-medium" title={workspaceFolder}>
            {workspaceFolder.replace(/\\/g, '/').split('/').pop() ?? workspaceFolder}
          </span>
          <button
            className="bg-transparent border border-border rounded text-muted-foreground cursor-pointer text-xs px-1.5 shrink-0 hover:bg-secondary hover:text-foreground transition-colors"
            onClick={handleOpen}
            title="Change folder"
          >
            …
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 gap-2.5 p-4 text-muted-foreground text-[12px] text-center">
          <button
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 border-none cursor-pointer"
            onClick={handleOpen}
          >
            Open Folder…
          </button>
          <p>No workspace folder open.</p>
        </div>
      )}
    </div>
  )
}
