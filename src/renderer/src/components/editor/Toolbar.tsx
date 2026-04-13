import {
  FilePlus, FolderOpen, Save, SaveAll, FileX,
  Scissors, Copy, Clipboard,
  Undo2, Redo2,
  Search, Replace,
  ZoomIn, ZoomOut, RotateCcw,
  IndentIncrease, IndentDecrease, MessageSquare,
  ArrowUpDown, Eraser,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import { editorRegistry } from '../../utils/editorRegistry'
import { shortcutMod } from '../../utils/platform'

interface ToolbarProps {
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onSaveAll: () => void
  onFind: () => void
  onReplace: () => void
  onClose: () => void
}

interface ToolbarItem {
  icon: React.ReactNode
  title: string
  action?: () => void
}

function editorCommand(command: string) {
  const editor = editorRegistry.get()
  if (!editor) return
  switch (command) {
    case 'zoomIn': editor.trigger('keyboard', 'editor.action.fontZoomIn', {}); break
    case 'zoomOut': editor.trigger('keyboard', 'editor.action.fontZoomOut', {}); break
    case 'zoomReset': editor.trigger('keyboard', 'editor.action.fontZoomReset', {}); break
    case 'indentLines': editor.trigger('keyboard', 'editor.action.indentLines', {}); break
    case 'outdentLines': editor.trigger('keyboard', 'editor.action.outdentLines', {}); break
    case 'toggleComment': editor.getAction('editor.action.commentLine')?.run(); break
    case 'sortLinesAsc': editor.getAction('editor.action.sortLinesAscending')?.run(); break
    case 'trimTrailingWhitespace': editor.getAction('editor.action.trimTrailingWhitespace')?.run(); break
  }
}

export function Toolbar({ onNew, onOpen, onSave, onSaveAll, onFind, onReplace, onClose }: ToolbarProps) {
  const mod = shortcutMod()
  const groups: ToolbarItem[][] = [
    // File
    [
      { icon: <FilePlus size={18} />, title: `New (${mod}+N)`, action: onNew },
      { icon: <FolderOpen size={18} />, title: `Open (${mod}+O)`, action: onOpen },
      { icon: <Save size={18} />, title: `Save (${mod}+S)`, action: onSave },
      { icon: <SaveAll size={18} />, title: 'Save All', action: onSaveAll },
      { icon: <FileX size={18} />, title: `Close (${mod}+W)`, action: onClose },
    ],
    // Edit
    [
      { icon: <Undo2 size={18} />, title: `Undo (${mod}+Z)`, action: () => window.dispatchEvent(new CustomEvent('editor:undo')) },
      { icon: <Redo2 size={18} />, title: `Redo (${mod}+Y)`, action: () => window.dispatchEvent(new CustomEvent('editor:redo')) },
    ],
    // Clipboard
    [
      { icon: <Scissors size={18} />, title: `Cut (${mod}+X)`, action: () => document.execCommand('cut') },
      { icon: <Copy size={18} />, title: `Copy (${mod}+C)`, action: () => document.execCommand('copy') },
      { icon: <Clipboard size={18} />, title: `Paste (${mod}+V)`, action: () => document.execCommand('paste') },
    ],
    // Search
    [
      { icon: <Search size={18} />, title: `Find (${mod}+F)`, action: onFind },
      { icon: <Replace size={18} />, title: `Replace (${mod}+H)`, action: onReplace },
    ],
    // Zoom
    [
      { icon: <ZoomIn size={18} />, title: 'Zoom In', action: () => editorCommand('zoomIn') },
      { icon: <ZoomOut size={18} />, title: 'Zoom Out', action: () => editorCommand('zoomOut') },
      { icon: <RotateCcw size={18} />, title: 'Reset Zoom', action: () => editorCommand('zoomReset') },
    ],
    // Formatting
    [
      { icon: <IndentIncrease size={18} />, title: 'Indent', action: () => editorCommand('indentLines') },
      { icon: <IndentDecrease size={18} />, title: 'Outdent', action: () => editorCommand('outdentLines') },
      { icon: <MessageSquare size={18} />, title: 'Toggle Comment', action: () => editorCommand('toggleComment') },
    ],
    // Actions
    [
      { icon: <ArrowUpDown size={18} />, title: 'Sort Lines', action: () => editorCommand('sortLinesAsc') },
      { icon: <Eraser size={18} />, title: 'Trim Whitespace', action: () => editorCommand('trimTrailingWhitespace') },
    ],
  ]

  return (
    <div className="h-9 bg-toolbar border-b border-toolbar-border flex items-center px-2 gap-0.5 select-none shrink-0 overflow-x-auto" data-testid="toolbar">
      <TooltipProvider delayDuration={300}>
        {groups.map((group, gi) => (
          <div key={gi} className="flex items-center">
            {gi > 0 && <div className="w-px h-5 bg-toolbar-border mx-1 shrink-0" />}
            {group.map((item, ii) => (
              <Tooltip key={ii}>
                <TooltipTrigger asChild>
                  <button
                    className="w-8 h-7 flex items-center justify-center text-toolbar-foreground hover:bg-secondary active:bg-muted rounded-sm transition-colors shrink-0"
                    onClick={item.action}
                  >
                    {item.icon}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-base">
                  {item.title}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        ))}
      </TooltipProvider>
    </div>
  )
}
