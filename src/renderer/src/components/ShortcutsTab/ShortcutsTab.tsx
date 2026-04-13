import { Keyboard } from 'lucide-react'

export function ShortcutsTab() {
  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-background" data-testid="shortcuts-tab">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Keyboard Shortcuts</h2>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 px-8">
        <Keyboard size={48} strokeWidth={1.2} />
        <div className="text-sm font-medium text-foreground">Keyboard Shortcuts editor — coming soon</div>
        <p className="text-[11px] text-center max-w-[460px] leading-relaxed">
          This is a placeholder. A full keyboard-shortcut editor will live here in a future release.
          For now, shortcuts are defined in the application menu and can be viewed alongside each menu item.
        </p>
      </div>
    </div>
  )
}
