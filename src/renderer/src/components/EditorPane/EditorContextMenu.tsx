import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '../ui/context-menu'

const isMac = window.api.platform === 'darwin'
const mod = isMac ? '⌘' : 'Ctrl'

const editorCmd = (cmd: string) =>
  window.dispatchEvent(new CustomEvent('editor:command', { detail: cmd }))

interface EditorContextMenuProps {
  children: React.ReactNode
}

export function EditorContextMenu({ children }: EditorContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-[200px]">
        <ContextMenuItem onSelect={() => document.execCommand('cut')}>
          Cut
          <ContextMenuShortcut>{mod}+X</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => document.execCommand('copy')}>
          Copy
          <ContextMenuShortcut>{mod}+C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => document.execCommand('paste')}>
          Paste
          <ContextMenuShortcut>{mod}+V</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onSelect={() => document.execCommand('selectAll')}>
          Select All
          <ContextMenuShortcut>{mod}+A</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onSelect={() => editorCmd('goToLine')}>
          Go to Line...
          <ContextMenuShortcut>{mod}+G</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => editorCmd('toggleComment')}>
          Toggle Comment
          <ContextMenuShortcut>{mod}+/</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSub>
          <ContextMenuSubTrigger>Convert Case</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onSelect={() => editorCmd('toUpperCase')}>
              UPPERCASE
              <ContextMenuShortcut>{mod}+Shift+U</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => editorCmd('toLowerCase')}>
              lowercase
              <ContextMenuShortcut>{mod}+U</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => editorCmd('toTitleCase')}>
              Title Case
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  )
}
