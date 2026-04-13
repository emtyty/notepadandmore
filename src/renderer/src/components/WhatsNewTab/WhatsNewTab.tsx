import { Sparkles } from 'lucide-react'

export function WhatsNewTab() {
  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-background" data-testid="whatsnew-tab">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">What's New</h2>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 px-8">
        <Sparkles size={48} strokeWidth={1.2} />
        <div className="text-sm font-medium text-foreground">Coming soon</div>
        <p className="text-base text-center max-w-[460px] leading-relaxed">
          Release notes and highlights for new versions of NovaPad will appear here.
        </p>
      </div>
    </div>
  )
}
