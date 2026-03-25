import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useUIStore } from '../../store/uiStore'
import { useFileOps } from '../../hooks/useFileOps'
import styles from './FileBrowserPanel.module.css'

interface TreeNode {
  name: string
  path: string
  isDir: boolean
  children?: TreeNode[]
}

interface ContextMenuState {
  x: number
  y: number
  node: TreeNode
}

function parentDir(p: string): string {
  const normalized = p.replace(/\\/g, '/')
  return normalized.substring(0, normalized.lastIndexOf('/')) || normalized
}

function joinPath(dir: string, name: string): string {
  const normalized = dir.replace(/\\/g, '/')
  return normalized.endsWith('/') ? normalized + name : normalized + '/' + name
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const iconMap: Record<string, string> = {
    ts: '📘', tsx: '📘', js: '📙', jsx: '📙',
    json: '📋', md: '📝', txt: '📄', html: '🌐',
    css: '🎨', scss: '🎨', py: '🐍', rs: '🦀',
    go: '🔵', java: '☕', cpp: '⚙️', c: '⚙️',
    sh: '🔧', yaml: '📋', yml: '📋', xml: '📋',
    png: '🖼️', jpg: '🖼️', gif: '🖼️', svg: '🖼️',
    pdf: '📕', zip: '📦', gz: '📦', tar: '📦',
  }
  return iconMap[ext] ?? '📄'
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
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void
}

function TreeNodeRow({ node, depth, expanded, onToggle, onOpen, onContextMenu }: TreeNodeRowProps) {
  return (
    <>
      <div
        className={styles.row}
        style={{ paddingLeft: depth * 14 + 6 }}
        onClick={() => (node.isDir ? onToggle(node) : onOpen(node))}
        onDoubleClick={() => !node.isDir && onOpen(node)}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, node) }}
        title={node.path}
      >
        <span className={styles.arrow}>
          {node.isDir ? (expanded.has(node.path) ? '▾' : '▸') : ''}
        </span>
        <span className={styles.fileIcon}>
          {node.isDir ? (expanded.has(node.path) ? '📂' : '📁') : getFileIcon(node.name)}
        </span>
        <span className={styles.name}>{node.name}</span>
      </div>
      {node.isDir && expanded.has(node.path) && node.children?.map((child) => (
        <TreeNodeRow
          key={child.path}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
          onOpen={onOpen}
          onContextMenu={onContextMenu}
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
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // Load root when workspaceFolder changes
  useEffect(() => {
    if (!workspaceFolder) { setTree([]); return }
    setExpanded(new Set())
    loadChildren(workspaceFolder).then(setTree)
  }, [workspaceFolder])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenu])

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

  const handleContextMenu = useCallback((e: React.MouseEvent, node: TreeNode) => {
    setContextMenu({ x: e.clientX, y: e.clientY, node })
  }, [])

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
    setContextMenu(null)
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
    setContextMenu(null)
    const dir = node.isDir ? node.path : parentDir(node.path)
    const name = prompt('New folder name:')
    if (!name?.trim()) return
    const fp = joinPath(dir, name.trim())
    const result = await window.api.file.mkdir(fp)
    if (result.error) { alert(`Error: ${result.error}`); return }
    await refreshParent(dir)
  }, [refreshParent])

  const handleRename = useCallback(async (node: TreeNode) => {
    setContextMenu(null)
    const newName = prompt('Rename to:', node.name)
    if (!newName?.trim() || newName.trim() === node.name) return
    const newPath = joinPath(parentDir(node.path), newName.trim())
    const result = await window.api.file.rename(node.path, newPath)
    if (result.error) { alert(`Error: ${result.error}`); return }
    await refreshParent(node.path)
  }, [refreshParent])

  const handleDelete = useCallback(async (node: TreeNode) => {
    setContextMenu(null)
    if (!confirm(`Delete "${node.name}"? This cannot be undone.`)) return
    const result = await window.api.file.delete(node.path)
    if (result.error) { alert(`Error: ${result.error}`); return }
    await refreshParent(node.path)
  }, [refreshParent])

  const handleCopyPath = useCallback((node: TreeNode) => {
    setContextMenu(null)
    navigator.clipboard.writeText(node.path)
  }, [])

  const handleReveal = useCallback((node: TreeNode) => {
    setContextMenu(null)
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
      <div className={styles.panel}>
        <div className={styles.noRoot}>
          <button className={styles.openBtn} onClick={handleOpenFolder}>Open Folder…</button>
          <p>Open a folder to browse files.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>{workspaceFolder.replace(/\\/g, '/').split('/').pop()}</span>
        <button className={styles.refreshBtn} onClick={handleRefresh} title="Refresh">↻</button>
      </div>
      <div className={styles.tree}>
        {tree.length === 0 ? (
          <div className={styles.empty}>Empty folder</div>
        ) : (
          tree.map((node) => (
            <TreeNodeRow
              key={node.path}
              node={node}
              depth={0}
              expanded={expanded}
              onToggle={handleToggle}
              onOpen={handleOpen}
              onContextMenu={handleContextMenu}
            />
          ))
        )}
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className={styles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {!contextMenu.node.isDir && (
            <button className={styles.contextItem} onClick={() => { setContextMenu(null); handleOpen(contextMenu.node) }}>
              Open
            </button>
          )}
          <button className={styles.contextItem} onClick={() => handleNewFile(contextMenu.node)}>
            New File…
          </button>
          <button className={styles.contextItem} onClick={() => handleNewFolder(contextMenu.node)}>
            New Folder…
          </button>
          <div className={styles.contextSeparator} />
          <button className={styles.contextItem} onClick={() => handleRename(contextMenu.node)}>
            Rename
          </button>
          <button className={styles.contextItem} onClick={() => handleDelete(contextMenu.node)}>
            Delete
          </button>
          <div className={styles.contextSeparator} />
          <button className={styles.contextItem} onClick={() => handleCopyPath(contextMenu.node)}>
            Copy Path
          </button>
          <button className={styles.contextItem} onClick={() => handleReveal(contextMenu.node)}>
            Reveal in {window.api.platform === 'darwin' ? 'Finder' : 'Explorer'}
          </button>
        </div>
      )}
    </div>
  )
}
