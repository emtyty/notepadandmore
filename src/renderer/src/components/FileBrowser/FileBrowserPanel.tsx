import React, { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronRight, ChevronDown, FolderOpen, Folder, FileText, RefreshCw } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '../ui/context-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import { useUIStore } from '../../store/uiStore'
import { useFileOps } from '../../hooks/useFileOps'
import { cn } from '../../lib/utils'

interface TreeNode {
  name: string
  path: string
  isDir: boolean
  children?: TreeNode[]
}

function parentDir(p: string): string {
  const normalized = p.replace(/\\/g, '/')
  return normalized.substring(0, normalized.lastIndexOf('/')) || normalized
}

function joinPath(dir: string, name: string): string {
  const normalized = dir.replace(/\\/g, '/')
  return normalized.endsWith('/') ? normalized + name : normalized + '/' + name
}

async function loadChildren(dirPath: string): Promise<TreeNode[]> {
  const entries = await window.api.file.listDir(dirPath)
  return [...entries]
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    .map((e) => ({ name: e.name, path: e.path, isDir: e.isDir }))
}

function updateNodeChildren(nodes: TreeNode[], targetPath: string, children: TreeNode[]): TreeNode[] {
  return nodes.map((n) => {
    if (n.path === targetPath) return { ...n, children }
    if (n.children) return { ...n, children: updateNodeChildren(n.children, targetPath, children) }
    return n
  })
}

interface TreeNodeRowProps {
  node: TreeNode
  depth: number
  expanded: Set<string>
  onToggle: (node: TreeNode) => void
  onOpen: (node: TreeNode) => void
  onContextMenu: (node: TreeNode) => void
  handleNewFile: (node: TreeNode) => void
  handleNewFolder: (node: TreeNode) => void
  handleRename: (node: TreeNode) => void
  handleDelete: (node: TreeNode) => void
  handleCopyPath: (node: TreeNode) => void
  handleReveal: (node: TreeNode) => void
}

function TreeNodeRow({ node, depth, expanded, onToggle, onOpen, onContextMenu, handleNewFile, handleNewFolder, handleRename, handleDelete, handleCopyPath, handleReveal }: TreeNodeRowProps) {
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="w-full flex items-center gap-1 py-[3px] text-[11px] transition-colors hover:bg-explorer-hover cursor-pointer text-explorer-foreground"
            style={{ paddingLeft: depth * 14 + 10 }}
            onClick={() => (node.isDir ? onToggle(node) : onOpen(node))}
            title={node.path}
          >
            <span className="shrink-0 w-3 text-muted-foreground">
              {node.isDir ? (
                expanded.has(node.path) ? <ChevronDown size={12} /> : <ChevronRight size={12} />
              ) : null}
            </span>
            <span className="shrink-0 text-primary">
              {node.isDir ? (
                expanded.has(node.path) ? <FolderOpen size={13} /> : <Folder size={13} />
              ) : (
                <FileText size={13} className="text-tab-muted" />
              )}
            </span>
            <span className="truncate">{node.name}</span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          {!node.isDir && (
            <ContextMenuItem onClick={() => onOpen(node)}>Open</ContextMenuItem>
          )}
          <ContextMenuItem onClick={() => handleNewFile(node)}>New File…</ContextMenuItem>
          <ContextMenuItem onClick={() => handleNewFolder(node)}>New Folder…</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => handleRename(node)}>Rename</ContextMenuItem>
          <ContextMenuItem onClick={() => handleDelete(node)}>Delete</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => handleCopyPath(node)}>Copy Path</ContextMenuItem>
          <ContextMenuItem onClick={() => handleReveal(node)}>
            Reveal in {window.api.platform === 'darwin' ? 'Finder' : 'Explorer'}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {node.isDir && expanded.has(node.path) && node.children?.map((child) => (
        <TreeNodeRow
          key={child.path}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
          onOpen={onOpen}
          onContextMenu={onContextMenu}
          handleNewFile={handleNewFile}
          handleNewFolder={handleNewFolder}
          handleRename={handleRename}
          handleDelete={handleDelete}
          handleCopyPath={handleCopyPath}
          handleReveal={handleReveal}
        />
      ))}
    </>
  )
}

export function FileBrowserPanel() {
  const { workspaceFolder, setWorkspaceFolder, setSidebarPanel } = useUIStore()
  const { openFiles } = useFileOps()
  const [tree, setTree] = useState<TreeNode[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Load root when workspaceFolder changes
  useEffect(() => {
    if (!workspaceFolder) { setTree([]); return }
    setExpanded(new Set())
    loadChildren(workspaceFolder).then(setTree)
  }, [workspaceFolder])

  const handleToggle = useCallback(async (node: TreeNode) => {
    const newExpanded = new Set(expanded)
    if (expanded.has(node.path)) {
      newExpanded.delete(node.path)
    } else {
      newExpanded.add(node.path)
      if (!node.children) {
        const children = await loadChildren(node.path)
        setTree((prev) => updateNodeChildren(prev, node.path, children))
      }
    }
    setExpanded(newExpanded)
  }, [expanded])

  const handleOpen = useCallback((node: TreeNode) => {
    openFiles([node.path])
  }, [openFiles])

  const refreshParent = useCallback(async (nodePath: string) => {
    const dir = nodePath === workspaceFolder ? workspaceFolder : parentDir(nodePath)
    if (!dir) return
    const children = await loadChildren(dir)
    if (dir === workspaceFolder) {
      setTree(children)
    } else {
      setTree((prev) => updateNodeChildren(prev, dir, children))
    }
  }, [workspaceFolder])

  const handleRefresh = useCallback(async () => {
    if (!workspaceFolder) return
    const children = await loadChildren(workspaceFolder)
    setTree(children)
  }, [workspaceFolder])

  const handleNewFile = useCallback(async (node: TreeNode) => {
    const dir = node.isDir ? node.path : parentDir(node.path)
    const name = prompt('New file name:')
    if (!name?.trim()) return
    const fp = joinPath(dir, name.trim())
    const result = await window.api.file.create(fp)
    if (result.error) { alert(`Error: ${result.error}`); return }
    await refreshParent(dir)
    openFiles([fp])
  }, [refreshParent, openFiles])

  const handleNewFolder = useCallback(async (node: TreeNode) => {
    const dir = node.isDir ? node.path : parentDir(node.path)
    const name = prompt('New folder name:')
    if (!name?.trim()) return
    const fp = joinPath(dir, name.trim())
    const result = await window.api.file.mkdir(fp)
    if (result.error) { alert(`Error: ${result.error}`); return }
    await refreshParent(dir)
  }, [refreshParent])

  const handleRename = useCallback(async (node: TreeNode) => {
    const newName = prompt('Rename to:', node.name)
    if (!newName?.trim() || newName.trim() === node.name) return
    const newPath = joinPath(parentDir(node.path), newName.trim())
    const result = await window.api.file.rename(node.path, newPath)
    if (result.error) { alert(`Error: ${result.error}`); return }
    await refreshParent(node.path)
  }, [refreshParent])

  const handleDelete = useCallback(async (node: TreeNode) => {
    if (!confirm(`Delete "${node.name}"? This cannot be undone.`)) return
    const result = await window.api.file.delete(node.path)
    if (result.error) { alert(`Error: ${result.error}`); return }
    await refreshParent(node.path)
  }, [refreshParent])

  const handleCopyPath = useCallback((node: TreeNode) => {
    navigator.clipboard.writeText(node.path)
  }, [])

  const handleReveal = useCallback((node: TreeNode) => {
    window.api.file.reveal(node.path)
  }, [])

  const handleOpenFolder = async () => {
    const result = await window.api.file.openDirDialog()
    if (!result) return
    setWorkspaceFolder(result)
    setSidebarPanel('files')
  }

  if (!workspaceFolder) {
    return (
      <div className="flex flex-col h-full overflow-hidden text-foreground">
        <div className="flex flex-col items-center justify-center flex-1 gap-2.5 p-4 text-muted-foreground text-[12px] text-center">
          <button
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 border-none cursor-pointer"
            onClick={handleOpenFolder}
          >
            Open Folder…
          </button>
          <p>Open a folder to browse files.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden text-foreground relative">
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-1.5 shrink-0">
        <span>{workspaceFolder.replace(/\\/g, '/').split('/').pop()}</span>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="bg-transparent border-none cursor-pointer text-muted-foreground p-0.5 rounded hover:text-foreground hover:bg-secondary"
                onClick={handleRefresh}
              >
                <RefreshCw size={12} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Refresh</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden editor-scrollbar select-none py-1">
        {tree.length === 0 ? (
          <div className="p-4 text-muted-foreground text-xs text-center">Empty folder</div>
        ) : (
          tree.map((node) => (
            <TreeNodeRow
              key={node.path}
              node={node}
              depth={0}
              expanded={expanded}
              onToggle={handleToggle}
              onOpen={handleOpen}
              onContextMenu={() => {}}
              handleNewFile={handleNewFile}
              handleNewFolder={handleNewFolder}
              handleRename={handleRename}
              handleDelete={handleDelete}
              handleCopyPath={handleCopyPath}
              handleReveal={handleReveal}
            />
          ))
        )}
      </div>
    </div>
  )
}
